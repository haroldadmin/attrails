use anyhow::Result;
use lapin::{
    Channel, Connection, ConnectionProperties, ExchangeKind,
    message::Delivery,
    options::{
        BasicAckOptions, BasicCancelOptions, BasicConsumeOptions, BasicNackOptions,
        BasicPublishOptions, ExchangeDeclareOptions, QueueBindOptions, QueueDeclareOptions,
    },
    protocol::basic::AMQPProperties,
    types::{AMQPValue, FieldTable, ShortString},
};
use serde::Deserialize;
use std::{collections::BTreeMap, fmt::Display, future::Ready};
use tokio_stream::StreamExt;
use tokio_util::sync::CancellationToken;
use tracing::{Instrument, Span, debug, error, info, info_span, warn};

mod messages;
mod propagation;

pub use messages::BlobMsg;
pub use messages::LabelMsg;

pub const EXCHANGE: &str = "tap-events-dlx";

#[derive(Debug)]
pub enum Queue {
    Routes,
    RoutesDlq,
    Reviews,
    ReviewsDlq,
    Profiles,
    ProfilesDlq,
    Blobs,
    BlobsDlq,
    Identity,
    IdentityDlq,
    Labels,
    LabelsDlq,
}

impl Queue {
    #[must_use]
    pub fn name(&self) -> &'static str {
        match self {
            Queue::Routes => "tap-events-routes",
            Queue::RoutesDlq => "tap-events-routes.dlq",
            Queue::Reviews => "tap-events-reviews",
            Queue::ReviewsDlq => "tap-events-reviews.dlq",
            Queue::Profiles => "tap-events-profiles",
            Queue::ProfilesDlq => "tap-events-profiles.dlq",
            Queue::Blobs => "tap-events-blobs",
            Queue::BlobsDlq => "tap-events-blobs.dlq",
            Queue::Identity => "tap-events-identity",
            Queue::IdentityDlq => "tap-events-identity.dlq",
            Queue::Labels => "tap-events-labels",
            Queue::LabelsDlq => "tap-events-labels.dlq",
        }
    }

    /// Publish a durable message to this queue with a JSON payload over
    /// `EXCHANGE`.
    ///
    /// The message headers carry the trace context of the publish span, so
    /// that consumers continue the same trace.
    ///
    /// # Errors
    ///
    /// Will return `Err` if the payload can not be serialised to bytes, or
    /// if publishing the message fails
    pub async fn publish(&self, payload: &[u8], channel: &Channel) -> Result<()> {
        let span = self.span("send", "producer");
        let headers = propagation::inject(&span);

        channel
            .basic_publish(
                "".into(),
                self.name().into(),
                BasicPublishOptions::default(),
                payload,
                AMQPProperties::default()
                    .with_content_type("application/json".into())
                    .with_delivery_mode(2)
                    .with_headers(headers),
            )
            .instrument(span)
            .await?;
        Ok(())
    }

    /// Consume messages from the queue until `shutdown` is cancelled.
    ///
    /// Each delivery is processed in its own span, which continues the trace
    /// in the message headers when they carry one.
    ///
    /// Cancellation stops new deliveries. A callback that is already running
    /// is allowed to finish, after which the consumer is cancelled.
    ///
    /// # Errors
    ///
    /// Returns an error if the consumer can not be started.
    pub async fn consume<T, F>(
        &self,
        channel: &Channel,
        shutdown: &CancellationToken,
        mut callback: F,
    ) -> Result<()>
    where
        F: AsyncFnMut(T) -> Result<()>,
        T: for<'a> Deserialize<'a>,
    {
        let queue_name = self.name();
        let consumer_tag: ShortString = format!("{}-consumer", self.name()).into();

        let mut consumer = channel
            .basic_consume(
                queue_name.into(),
                consumer_tag.clone(),
                BasicConsumeOptions::default(),
                FieldTable::default(),
            )
            .await?;

        while let Some(Some(delivery_attempt)) = shutdown.run_until_cancelled(consumer.next()).await
        {
            let delivery = match delivery_attempt {
                Ok(delivery) => delivery,
                Err(error) => {
                    warn!(%error, "ignoring consumer stream error");
                    continue;
                }
            };

            let span = self.span("process", "consumer");
            propagation::extract(&span, delivery.properties.headers().as_ref());
            process(delivery, &mut callback).instrument(span).await;
        }

        if channel.status().connected()
            && let Err(error) = channel
                .basic_cancel(consumer_tag, BasicCancelOptions::default())
                .await
        {
            warn!(%error, queue = queue_name, "failed to cancel consumer");
        }

        Ok(())
    }

    /// A span for a messaging operation on this queue, named and attributed
    /// following the OpenTelemetry messaging semantic conventions.
    fn span(&self, operation: &'static str, kind: &'static str) -> Span {
        info_span!(
            "amqp",
            otel.name = format!("{operation} {self}"),
            otel.kind = kind,
            messaging.system = "rabbitmq",
            messaging.operation.type = operation,
            messaging.destination.name = self.name(),
        )
    }
}

/// Validate and deserialize a delivery, run the callback on it, and
/// acknowledge it.
async fn process<T, F>(delivery: Delivery, callback: &mut F)
where
    F: AsyncFnMut(T) -> Result<()>,
    T: for<'a> Deserialize<'a>,
{
    if delivery.data.is_empty() {
        info!("discarding empty message");
        let _ = delivery.ack(BasicAckOptions::default()).await;
        return;
    }

    let Some(content_type) = delivery.properties.content_type() else {
        error!("no content_type header in message");
        let _ = delivery.nack(BasicNackOptions::default()).await;
        return;
    };

    if content_type.as_str() != "application/json" {
        error!("non-json messages are not supported");
        let _ = delivery.nack(BasicNackOptions::default()).await;
        return;
    }

    let payload = match serde_json::from_slice::<T>(&delivery.data) {
        Ok(payload) => payload,
        Err(error) => {
            error!(%error, "failed to deserialize payload");
            let _ = delivery.nack(BasicNackOptions::default()).await;
            return;
        }
    };

    match callback(payload).await {
        Ok(()) => {
            debug!("message processed");
            let _ = delivery.ack(BasicAckOptions::default()).await;
        }
        Err(error) => {
            error!(%error,"failed to process message");
            let _ = delivery.nack(BasicNackOptions::default()).await;
        }
    }
}

impl Display for Queue {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.write_str(self.name())
    }
}

/// Return a readiness check for the channel.
///
/// The check is synchronous and only inspects the channel's current status.
pub fn health_check(channel: &Channel) -> impl Fn() -> Ready<Result<()>> + Send + Sync + 'static {
    let channel = channel.clone();

    move || {
        let result = if channel.status().connected() {
            Ok(())
        } else {
            Err(anyhow::Error::msg("amqp channel is not connected"))
        };

        std::future::ready(result)
    }
}

/// Establish a connection to a Rabbit MQ instance using the given
/// connection uri.
///
/// # Errors
///
/// Will return an `Err` if the connection fails, or if a channel
/// can not be opened over the connection.
pub async fn amqp_connect(rabbitmq_uri: &str) -> Result<Channel> {
    let conn = Connection::connect(
        rabbitmq_uri,
        ConnectionProperties::default().enable_auto_recover(),
    )
    .await?;
    let channel = conn.create_channel().await?;

    Ok(channel)
}

/// Verify that the Rabbit MQ instance contains the topology
/// we expect in this application.
///
/// # Errors
///
/// Will return an `Err` if declaring any topology element fails
pub async fn declare_topology(channel: &Channel) -> Result<()> {
    let exchange_name: ShortString = EXCHANGE.into();

    channel
        .exchange_declare(
            exchange_name,
            ExchangeKind::Direct,
            ExchangeDeclareOptions {
                durable: true,
                ..Default::default()
            },
            FieldTable::default(),
        )
        .await?;

    declare_queue(&Queue::Routes, &Queue::RoutesDlq, EXCHANGE, channel).await?;
    declare_queue(&Queue::Reviews, &Queue::ReviewsDlq, EXCHANGE, channel).await?;
    declare_queue(&Queue::Blobs, &Queue::BlobsDlq, EXCHANGE, channel).await?;
    declare_queue(&Queue::Profiles, &Queue::ProfilesDlq, EXCHANGE, channel).await?;
    declare_queue(&Queue::Identity, &Queue::IdentityDlq, EXCHANGE, channel).await?;
    declare_queue(&Queue::Labels, &Queue::LabelsDlq, EXCHANGE, channel).await?;

    info!("RabbitMQ topology asserted");

    Ok(())
}

async fn declare_queue(
    queue: &Queue,
    dlq: &Queue,
    exchange_name: &str,
    channel: &Channel,
) -> Result<()> {
    channel
        .queue_declare(
            queue.name().into(),
            QueueDeclareOptions::durable(),
            BTreeMap::from([
                (
                    ShortString::from("x-queue-type"),
                    AMQPValue::LongString("quorum".into()),
                ),
                (ShortString::from("x-delivery-limit"), AMQPValue::LongInt(5)),
                (
                    ShortString::from("x-dead-letter-exchange"),
                    AMQPValue::LongString(exchange_name.into()),
                ),
                (
                    ShortString::from("x-dead-letter-routing-key"),
                    AMQPValue::LongString(queue.name().into()),
                ),
            ])
            .into(),
        )
        .await?;

    channel
        .queue_declare(
            dlq.name().into(),
            QueueDeclareOptions::durable(),
            BTreeMap::from([(
                ShortString::from("x-queue-type"),
                AMQPValue::LongString("quorum".into()),
            )])
            .into(),
        )
        .await?;

    channel
        .queue_bind(
            dlq.name().into(),
            exchange_name.into(),
            queue.name().into(),
            QueueBindOptions::default(),
            FieldTable::default(),
        )
        .await?;

    Ok(())
}

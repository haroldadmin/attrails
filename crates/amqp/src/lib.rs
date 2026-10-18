use serde::Deserialize;
use std::{collections::BTreeMap, fmt::Display};
use tokio_stream::StreamExt;

use anyhow::Result;
use lapin::{
    Channel, Connection, ConnectionProperties, ExchangeKind,
    options::{
        BasicAckOptions, BasicConsumeOptions, BasicNackOptions, BasicPublishOptions,
        ExchangeDeclareOptions, QueueBindOptions, QueueDeclareOptions,
    },
    protocol::basic::AMQPProperties,
    types::{AMQPValue, FieldTable, ShortString},
};
use tracing::{debug, error, info, warn};

mod messages;

pub use messages::BlobMsg;

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
        }
    }

    /// Publish a durable message to this queue with a JSON payload over
    /// `EXCHANGE`.
    ///
    /// # Errors
    ///
    /// Will return `Err` if the payload can not be serialised to bytes, or
    /// if publishing the message fails
    pub async fn publish(&self, payload: &[u8], channel: &Channel) -> Result<()> {
        channel
            .basic_publish(
                "".into(),
                self.name().into(),
                BasicPublishOptions::default(),
                payload,
                AMQPProperties::default()
                    .with_content_type("application/json".into())
                    .with_delivery_mode(2),
            )
            .await?;
        Ok(())
    }

    /// consumer for the queue
    ///
    /// # Errors
    ///
    /// Will return an error if the message fails to be processed
    pub async fn consume<T, F>(&self, channel: &Channel, mut callback: F) -> Result<()>
    where
        F: AsyncFnMut(T) -> Result<()>,
        T: for<'a> Deserialize<'a>,
    {
        let queue_name = self.name();
        let consumer_name = format!("{}-consumer", self.name());

        let mut consumer = channel
            .basic_consume(
                queue_name.into(),
                consumer_name.into(),
                BasicConsumeOptions::default(),
                FieldTable::default(),
            )
            .await?;

        while let Some(delivery_attempt) = consumer.next().await {
            let delivery = match delivery_attempt {
                Ok(delivery) => delivery,
                Err(error) => {
                    warn!(%error, "ignoring consumer stream error");
                    continue;
                }
            };

            if delivery.data.is_empty() {
                info!("discarding empty message");
                let _ = delivery.ack(BasicAckOptions::default()).await;
                continue;
            }

            let Some(content_type) = delivery.properties.content_type() else {
                error!("no content_type header in message");
                let _ = delivery.nack(BasicNackOptions::default()).await;
                continue;
            };

            if content_type.as_str() != "application/json" {
                error!("non-json messages are not supported");
                let _ = delivery.nack(BasicNackOptions::default()).await;
                continue;
            }

            let payload = match serde_json::from_slice::<T>(&delivery.data) {
                Ok(payload) => payload,
                Err(error) => {
                    error!(%error, "failed to deserialize payload");
                    let _ = delivery.nack(BasicNackOptions::default()).await;
                    continue;
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

        Ok(())
    }
}

impl Display for Queue {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.write_str(self.name())
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

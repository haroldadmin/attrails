use std::{collections::BTreeMap, fmt::Display};

use anyhow::Result;
use lapin::{
    Channel, Connection, ConnectionProperties, ExchangeKind,
    options::{BasicPublishOptions, ExchangeDeclareOptions, QueueBindOptions, QueueDeclareOptions},
    protocol::basic::AMQPProperties,
    types::{AMQPValue, FieldTable, ShortString},
};
use tracing::info;

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

    pub async fn publish(&self, value: &serde_json::Value, channel: &Channel) -> Result<()> {
        let payload = serde_json::to_vec(value)?;
        channel
            .basic_publish(
                EXCHANGE.into(),
                self.name().into(),
                BasicPublishOptions::default(),
                &payload,
                AMQPProperties::default()
                    .with_content_type("application/json".into())
                    .with_delivery_mode(2),
            )
            .await?;
        Ok(())
    }
}

impl Display for Queue {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.write_str(self.name())
    }
}

pub async fn amqp_connect(rabbitmq_uri: &str) -> Result<Channel> {
    let conn = Connection::connect(
        rabbitmq_uri,
        ConnectionProperties::default().enable_auto_recover(),
    )
    .await?;
    let channel = conn.create_channel().await?;

    Ok(channel)
}

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

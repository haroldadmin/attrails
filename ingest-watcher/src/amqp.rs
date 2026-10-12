use std::collections::BTreeMap;

use anyhow::Result;
use lapin::{
    Channel, Connection, ConnectionProperties, ExchangeKind, Queue,
    options::{ExchangeDeclareOptions, QueueBindOptions, QueueDeclareOptions},
    types::{AMQPValue, FieldTable, ShortString},
};
use tracing::info;

const EXCHANGE_NAME: &str = "tap-events-dlx";

const ROUTES_QUEUE_NAME: &str = "tap-events-routes";
const ROUTES_DLQ_NAME: &str = "tap-events-routes.dlq";
const ROUTES_DLQ_ROUTING_KEY: &str = "tap-events-routes";

const REVIEWS_QUEUE_NAME: &str = "tap-events-reviews";
const REVIEWS_DLQ_NAME: &str = "tap-events-reviews.dlq";
const REVIEWS_DLQ_ROUTING_KEY: &str = "tap-events-reviews";

const PROFILES_QUEUE_NAME: &str = "tap-events-profiles";
const PROFILES_DLQ_NAME: &str = "tap-events-profiles.dlq";
const PROFILES_DLQ_ROUTING_KEY: &str = "tap-events-profiles";

const BLOBS_QUEUE_NAME: &str = "tap-events-blobs";
const BLOBS_DLQ_NAME: &str = "tap-events-blobs.dlq";
const BLOBS_DLQ_ROUTING_KEY: &str = "tap-events-blobs";

pub async fn amqp_connect(rabbitmq_uri: &str) -> Result<Channel> {
    info!("connecting to rabbitmq");

    let conn = Connection::connect(
        rabbitmq_uri,
        ConnectionProperties::default().enable_auto_recover(),
    )
    .await?;
    let channel = conn.create_channel().await?;

    info!("rabbitmq connected");

    Ok(channel)
}

pub struct Topology {
    pub routes_queue: Queue,
    pub routes_dlq: Queue,
    pub reviews_queue: Queue,
    pub reviews_dlq: Queue,
    pub profiles_queue: Queue,
    pub profiles_dlq: Queue,
    pub blobs_queue: Queue,
    pub blobs_dlq: Queue,
}

impl Topology {
    pub async fn declare(channel: &Channel) -> Result<Self> {
        let exchange_name: ShortString = "tap-events-dlx".into();

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

        let (routes_queue, routes_dlq) = declare_queue(
            ROUTES_QUEUE_NAME,
            ROUTES_DLQ_NAME,
            ROUTES_DLQ_ROUTING_KEY,
            EXCHANGE_NAME,
            channel,
        )
        .await?;

        let (reviews_queue, reviews_dlq) = declare_queue(
            REVIEWS_QUEUE_NAME,
            REVIEWS_DLQ_NAME,
            REVIEWS_DLQ_ROUTING_KEY,
            EXCHANGE_NAME,
            channel,
        )
        .await?;

        let (profiles_queue, profiles_dlq) = declare_queue(
            PROFILES_QUEUE_NAME,
            PROFILES_DLQ_NAME,
            PROFILES_DLQ_ROUTING_KEY,
            EXCHANGE_NAME,
            channel,
        )
        .await?;

        let (blobs_queue, blobs_dlq) = declare_queue(
            BLOBS_QUEUE_NAME,
            BLOBS_DLQ_NAME,
            BLOBS_DLQ_ROUTING_KEY,
            EXCHANGE_NAME,
            channel,
        )
        .await?;

        info!("rabbitmq topology declared");

        Ok(Self {
            routes_queue,
            routes_dlq,
            reviews_queue,
            reviews_dlq,
            profiles_queue,
            profiles_dlq,
            blobs_queue,
            blobs_dlq,
        })
    }
}

async fn declare_queue(
    queue_name: &str,
    dlq_name: &str,
    dlq_routing_key: &str,
    exchange_name: &str,
    channel: &Channel,
) -> Result<(Queue, Queue)> {
    let queue = channel
        .queue_declare(
            queue_name.into(),
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
                    AMQPValue::LongString(dlq_routing_key.into()),
                ),
            ])
            .into(),
        )
        .await?;

    let dlq = channel
        .queue_declare(
            dlq_name.into(),
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
            dlq_name.into(),
            exchange_name.into(),
            dlq_routing_key.into(),
            QueueBindOptions::default(),
            FieldTable::default(),
        )
        .await?;

    Ok((queue, dlq))
}

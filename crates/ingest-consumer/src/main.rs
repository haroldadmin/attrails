use amqp::{Queue, amqp_connect, declare_topology};
use anyhow::Result;
use lapin::Channel;
use tracing_subscriber::EnvFilter;

mod config;

#[tokio::main]
async fn main() {
    tracing_subscriber::fmt()
        .with_env_filter(
            EnvFilter::try_from_default_env().unwrap_or_else(|_| EnvFilter::new("info")),
        )
        .init();

    let conf = config::Config::from_env().expect("failed to parse application config");

    let channel = amqp_connect(&conf.rabbitmq_host)
        .await
        .expect("failed to connect to rabbitmq");

    declare_topology(&channel)
        .await
        .expect("failed to declare rabbitmq topology");

    tokio::try_join!(
        consume_routes(&channel),
        consume_reviews(&channel),
        consume_profiles(&channel),
        consume_blobs(&channel),
    )
    .expect("a consumer failed");
}

async fn consume_routes(channel: &Channel) -> Result<()> {
    Queue::Routes
        .consume::<lexicons::app_attrails::v0::route::Route, _>(channel, async |route| {
            dbg!(route);
            Ok(())
        })
        .await
}

async fn consume_reviews(channel: &Channel) -> Result<()> {
    Queue::Reviews
        .consume::<lexicons::app_attrails::v0::review::Review, _>(channel, async |review| {
            dbg!(review);
            Ok(())
        })
        .await
}

async fn consume_profiles(channel: &Channel) -> Result<()> {
    Queue::Profiles
        .consume::<lexicons::app_attrails::actor::profile::Profile, _>(channel, async |profile| {
            dbg!(profile);
            Ok(())
        })
        .await
}

async fn consume_blobs(channel: &Channel) -> Result<()> {
    Queue::Blobs
        .consume::<serde_json::Value, _>(&channel, async |blob| {
            dbg!(blob);
            Ok(())
        })
        .await
}

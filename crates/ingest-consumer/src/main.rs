use amqp::{Queue, amqp_connect, declare_topology};
use anyhow::Result;
use atproto_tap::{RecordAction, RecordEvent};
use database::PgPool;
use lapin::Channel;
use tracing::{error, info};
use tracing_subscriber::EnvFilter;

mod config;
mod profiles;
mod reviews;
mod routes;

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

    let pool = database::connect(&conf.postgres_uri)
        .await
        .expect("failed to connect to postgres");

    tokio::try_join!(
        consume_routes(&channel, &pool),
        consume_reviews(&channel, &pool),
        consume_profiles(&channel, &pool),
        consume_blobs(&channel),
    )
    .expect("a consumer failed");
}

async fn consume_routes(channel: &Channel, pool: &PgPool) -> Result<()> {
    Queue::Routes
        .consume::<RecordEvent, _>(channel, async |event| {
            let uri = event.at_uri();

            match event.action {
                RecordAction::Create | RecordAction::Update => {
                    let parsed = event
                        .parse_record::<lexicons::app_attrails::v0::route::Route>()
                        .map_err(anyhow::Error::from)
                        .and_then(|route| routes::from_event(&event, &route));

                    // Invalid records will never succeed, so drop them
                    // instead of returning an error and retrying.
                    let route = match parsed {
                        Ok(route) => route,
                        Err(error) => {
                            error!(%error, uri, "discarding invalid route record");
                            return Ok(());
                        }
                    };

                    database::routes::upsert_route(pool, &route).await?;
                    info!(uri, "route upserted");
                }
                RecordAction::Delete => {
                    database::routes::tombstone_route(pool, &uri).await?;
                    info!(uri, "route tombstoned");
                }
            }

            Ok(())
        })
        .await
}

async fn consume_reviews(channel: &Channel, pool: &PgPool) -> Result<()> {
    Queue::Reviews
        .consume::<RecordEvent, _>(channel, async |event| {
            let uri = event.at_uri();

            match event.action {
                RecordAction::Create | RecordAction::Update => {
                    let parsed = event
                        .parse_record::<lexicons::app_attrails::v0::review::Review>()
                        .map_err(anyhow::Error::from)
                        .and_then(|review| reviews::from_event(&event, &review));

                    // Invalid records will never succeed, so drop them
                    // instead of returning an error and retrying.
                    let review = match parsed {
                        Ok(review) => review,
                        Err(error) => {
                            error!(%error, uri, "discarding invalid review record");
                            return Ok(());
                        }
                    };

                    database::reviews::upsert_review(pool, &review).await?;
                    info!(uri, "review upserted");
                }
                RecordAction::Delete => {
                    database::reviews::tombstone_review(pool, &uri).await?;
                    info!(uri, "review tombstoned");
                }
            }

            Ok(())
        })
        .await
}

async fn consume_profiles(channel: &Channel, pool: &PgPool) -> Result<()> {
    Queue::Profiles
        .consume::<RecordEvent, _>(channel, async |event| {
            let uri = event.at_uri();

            match event.action {
                RecordAction::Create | RecordAction::Update => {
                    let parsed = event
                        .parse_record::<lexicons::app_attrails::actor::profile::Profile>()
                        .map_err(anyhow::Error::from)
                        .and_then(|profile| profiles::from_event(&event, &profile));

                    // Invalid records will never succeed, so drop them
                    // instead of returning an error and retrying.
                    let user = match parsed {
                        Ok(user) => user,
                        Err(error) => {
                            error!(%error, uri, "discarding invalid profile record");
                            return Ok(());
                        }
                    };

                    database::users::upsert_user(pool, &user).await?;
                    info!(uri, "profile upserted");
                }
                RecordAction::Delete => {
                    database::users::tombstone_user(pool, &uri).await?;
                    info!(uri, "profile tombstoned");
                }
            }

            Ok(())
        })
        .await
}

async fn consume_blobs(channel: &Channel) -> Result<()> {
    Queue::Blobs
        .consume::<RecordEvent, _>(channel, async |event| {
            dbg!(event);
            Ok(())
        })
        .await
}

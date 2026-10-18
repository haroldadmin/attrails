use amqp::{BlobMsg, Queue, amqp_connect, declare_topology};
use anyhow::Result;
use atproto_tap::{RecordAction, RecordEvent};
use database::{PgPool, tracks::NewTrack};
use jacquard::client::BasicClient;
use jiff::Timestamp;
use lapin::Channel;
use tracing::{error, info};
use tracing_subscriber::EnvFilter;
use tracks::TrackData;

use crate::blobs::verify_cid;

mod blobs;
mod config;
mod profiles;
mod reviews;
mod routes;

const MAX_GPX_BYTES: usize = 976_563;

const ACCEPTED_GPX_MIME_TYPES: [&str; 3] = ["application/gpx+xml", "application/xml", "text/xml"];

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

    let agent = BasicClient::unauthenticated();

    tokio::try_join!(
        consume_routes(&channel, &pool),
        consume_reviews(&channel, &pool),
        consume_profiles(&channel, &pool),
        consume_blobs(&channel, &pool, &agent),
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
                        .and_then(|record| {
                            let route = routes::from_event(&event, &record)?;
                            Ok((route, routes::blob_msg(&event, &record)))
                        });

                    // Invalid records will never succeed, so drop them
                    // instead of returning an error and retrying.
                    let (route, msg) = match parsed {
                        Ok(parsed) => parsed,
                        Err(error) => {
                            error!(%error, uri, "discarding invalid route record");
                            return Ok(());
                        }
                    };

                    database::routes::upsert_route(pool, &route).await?;
                    info!(uri, "route upserted");

                    // If publishing fails the event is retried, which upserts
                    // the route again.
                    Queue::Blobs
                        .publish(&serde_json::to_vec(&msg)?, channel)
                        .await?;
                    info!(uri, cid = msg.cid, "gpx blob queued");
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

async fn consume_blobs(channel: &Channel, pool: &PgPool, agent: &BasicClient) -> Result<()> {
    Queue::Blobs
        .consume::<BlobMsg, _>(channel, async |msg| {
            if msg.size > MAX_GPX_BYTES {
                let err_msg = format!("blob is {} bytes, over the limit", msg.size);
                return Err(anyhow::Error::msg(err_msg));
            }

            if !ACCEPTED_GPX_MIME_TYPES.contains(&msg.mime_type.as_str()) {
                let err_msg = format!("unexpected blob mime type {:?}", msg.mime_type);
                return Err(anyhow::Error::msg(err_msg));
            }

            let BlobMsg { did, cid, .. } = msg;

            // Many routes can share a blob, and routes can be updated
            // without changing it.
            if database::tracks::track_exists(pool, &cid, tracks::PARSER_VERSION).await? {
                info!(did, cid, "gpx blob already parsed");
                return Ok(());
            }

            let blob = blobs::fetch_blob(agent, &did, &cid)
                .await
                .map_err(|e| e.context("failed to fetch GPX blob"))?;

            verify_cid(&cid, &blob)?;

            let track_data = tracks::TrackData::from_bytes(&blob)?;
            let track = new_track(&cid, &track_data)?;

            database::tracks::upsert_track(pool, &track).await?;
            info!(did, cid, "track upserted");

            Ok(())
        })
        .await
}

#[allow(clippy::cast_possible_truncation)]
fn new_track(cid: &str, track: &TrackData) -> Result<NewTrack> {
    let elevation = track.elevation.as_ref();
    let geometry =
        |value: geojson::GeometryValue| serde_json::to_value(geojson::Geometry::new(value));

    Ok(NewTrack {
        cid: cid.to_string(),
        parser_version: tracks::PARSER_VERSION,
        distance_m: track.distance_m,
        point_count: i32::try_from(track.point_count)
            .map_err(|e| anyhow::Error::from(e).context("track has too many points"))?,
        elevation_gain_m: elevation.map(|elevation| elevation.gain_m as f32),
        elevation_loss_m: elevation.map(|elevation| elevation.loss_m as f32),
        min_elevation_m: elevation.map(|elevation| elevation.min_m as f32),
        max_elevation_m: elevation.map(|elevation| elevation.max_m as f32),
        duration_sec: None,
        moving_time_sec: None,
        is_loop: track.is_loop,
        start_point: geometry((&track.start_point).into())?,
        end_point: geometry((&track.end_point).into())?,
        path: Some(geometry((&track.path).into())?),
        elevation_profile: Some(serde_json::to_value(&track.elevation_profile)?),
        waypoints: serde_json::to_value(&track.waypoints)?,
        processed_at: Timestamp::now(),
    })
}

use std::time::Duration;

use amqp::{BlobMsg, LabelMsg, Queue, amqp_connect, declare_topology};
use anyhow::{Context, Result, anyhow};
use atproto_tap::{IdentityEvent, IdentityStatus, RecordAction, RecordEvent};
use database::{
    PgPool,
    labels::NewLabels,
    reviews::fetch_review_moderation_view,
    routes::fetch_route_moderation_view,
    tracks::NewTrack,
    users::{fetch_user_moderation_view, tombstone_user, untombstone_user},
};
use jacquard::{
    client::BasicClient,
    types::{aturi::AtUri, collection::Collection},
};
use jiff::Timestamp;
use lapin::{Channel, protocol::constants::REPLY_SUCCESS};
use lexicons::app_attrails::{
    actor::profile::ProfileRecord,
    v0::{review::ReviewRecord, route::RouteRecord},
};
use lifecycle::{
    health::{Readiness, Server, check},
    shutdown::Shutdown,
};
use moderation::{Moderator, ModeratorConfig};
use serde_json::json;
use tokio::time::timeout;
use tokio_util::sync::CancellationToken;
use tracing::{error, info, info_span, warn};
use tracks::TrackData;

use crate::blobs::verify_cid;

mod blobs;
mod config;
mod profiles;
mod reviews;
mod routes;

const MAX_GPX_BYTES: usize = 976_563;

const ACCEPTED_GPX_MIME_TYPES: [&str; 3] = ["application/gpx+xml", "application/xml", "text/xml"];

/// Maximum time spent letting consumers finish in-flight work at shutdown.
const CONSUMER_SHUTDOWN_TIMEOUT: Duration = Duration::from_secs(30);

#[tokio::main]
async fn main() -> Result<()> {
    // Declared first so it is dropped last, flushing spans and logs on every
    // exit path.
    let _telemetry = telemetry::init()?;

    let conf = config::Config::from_env()?;

    // Register the signal handlers before any slow startup work, so that a
    // signal received during startup is queued instead of using the default
    // disposition.
    let mut shutdown = Shutdown::new()?;

    // Start serving probes before connecting to dependencies. Liveness is OK
    // as soon as the server is listening, while readiness reports 503 until
    // startup completes.
    let readiness = Readiness::new();
    let health = Server::bind(conf.health_port, readiness.clone()).await?;

    let channel = amqp_connect(&conf.rabbitmq_host).await?;
    declare_topology(&channel).await?;

    let pool = database::connect(&conf.postgres_uri).await?;
    let agent = BasicClient::unauthenticated();

    let moderator = Moderator::build(ModeratorConfig {
        decisions_api_base_url: conf.decisions_api_base_url,
        decisions_api_key: conf.decisions_api_key,
    })?;

    readiness.mark_started(vec![
        check("rabbitmq", amqp::health_check(&channel)),
        check("postgres", {
            let pool = pool.clone();
            move || database::ping(pool.clone())
        }),
    ]);

    let shutdown_token = CancellationToken::new();
    let consumers = async {
        tokio::try_join!(
            consume_routes(&channel, &pool, &shutdown_token),
            consume_reviews(&channel, &pool, &shutdown_token),
            consume_profiles(&channel, &pool, &shutdown_token),
            consume_blobs(&channel, &pool, &shutdown_token, &agent),
            consume_identity(&channel, &pool, &shutdown_token),
            consume_labels(&channel, &pool, &moderator, &shutdown_token),
        )
    };
    tokio::pin!(consumers);

    // Either a shutdown signal was received, or the consumers exited on their
    // own.
    let mut consumers_done = false;
    let failure = tokio::select! {
        biased;

        signal = shutdown.recv() => {
            info!(?signal, "shutdown signal received");
            None
        }
        result = &mut consumers => {
            consumers_done = true;
            Some(match result {
                Ok(_) => anyhow!("all consumers exited without a shutdown signal"),
                Err(error) => error.context("a consumer failed"),
            })
        }
    };

    readiness.mark_draining();
    shutdown_token.cancel();

    let cleanup = async {
        if !consumers_done && let Err(error) = (&mut consumers).await {
            error!(%error, "consumer failed during shutdown");
        }

        if channel.status().connected() {
            channel.close(REPLY_SUCCESS, "shutting down".into()).await?;
        }

        pool.close().await;

        Ok::<(), anyhow::Error>(())
    };

    match timeout(CONSUMER_SHUTDOWN_TIMEOUT, cleanup).await {
        Ok(Ok(())) => info!("graceful shutdown complete"),
        Ok(Err(error)) => error!(%error, "error during shutdown"),
        Err(_) => warn!("graceful shutdown timed out"),
    }

    health.shutdown().await?;

    if let Some(error) = failure {
        return Err(error);
    }

    Ok(())
}

async fn consume_routes(
    channel: &Channel,
    pool: &PgPool,
    shutdown: &CancellationToken,
) -> Result<()> {
    Queue::Routes
        .consume::<RecordEvent, _>(channel, shutdown, async |event| {
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

                    queue_labels(channel, &route.uri, &route.cid).await?;
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

async fn consume_reviews(
    channel: &Channel,
    pool: &PgPool,
    shutdown: &CancellationToken,
) -> Result<()> {
    Queue::Reviews
        .consume::<RecordEvent, _>(channel, shutdown, async |event| {
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

                    // If publishing fails the event is retried, which upserts
                    // the review again.
                    queue_labels(channel, &review.uri, &review.cid).await?;
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

async fn consume_profiles(
    channel: &Channel,
    pool: &PgPool,
    shutdown: &CancellationToken,
) -> Result<()> {
    Queue::Profiles
        .consume::<RecordEvent, _>(channel, shutdown, async |event| {
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

                    // If publishing fails the event is retried, which upserts
                    // the profile again.
                    queue_labels(channel, &user.uri, &user.cid).await?;
                }
                RecordAction::Delete => {
                    database::users::tombstone_user(pool, &event.did).await?;
                    info!(uri, "profile tombstoned");
                }
            }

            Ok(())
        })
        .await
}

async fn consume_blobs(
    channel: &Channel,
    pool: &PgPool,
    shutdown: &CancellationToken,
    agent: &BasicClient,
) -> Result<()> {
    Queue::Blobs
        .consume::<BlobMsg, _>(channel, shutdown, async |msg| {
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

            let track_data =
                info_span!("parse gpx").in_scope(|| tracks::TrackData::from_bytes(&blob))?;
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

async fn consume_identity(
    channel: &Channel,
    pool: &PgPool,
    shutdown: &CancellationToken,
) -> Result<()> {
    Queue::Identity
        .consume::<IdentityEvent, _>(channel, shutdown, async |msg| {
            let IdentityEvent { did, status, .. } = msg;

            match status {
                IdentityStatus::Active => untombstone_user(pool, &did)
                    .await
                    .with_context(|| format!("failed to untombstone user {did}"))?,
                IdentityStatus::Deactivated
                | IdentityStatus::Suspended
                | IdentityStatus::Deleted
                | IdentityStatus::Takendown => tombstone_user(pool, &did)
                    .await
                    .with_context(|| format!("failed to tombstone user {did}"))?,
            }

            info!(did, %status, "user identity updated");

            Ok(())
        })
        .await
}

/// Ask for a version of a record to be moderated.
async fn queue_labels(channel: &Channel, uri: &str, cid: &str) -> Result<()> {
    let msg = LabelMsg {
        uri: uri.to_string(),
        cid: cid.to_string(),
    };
    Queue::Labels
        .publish(&serde_json::to_vec(&msg)?, channel)
        .await?;
    info!(uri, cid, "labels queued");

    Ok(())
}

async fn consume_labels(
    channel: &Channel,
    pool: &PgPool,
    moderator: &Moderator,
    shutdown: &CancellationToken,
) -> Result<()> {
    Queue::Labels
        .consume::<LabelMsg, _>(channel, shutdown, async |msg| {
            let LabelMsg { uri, cid } = msg;

            let collection = match AtUri::new(uri.as_str()) {
                Ok(at_uri) => at_uri.collection().map(|nsid| nsid.as_str().to_string()),
                Err(error) => {
                    error!(%error, uri, "discarding label request with invalid uri");
                    return Ok(());
                }
            };

            // Only the version of a record that is currently indexed is
            // moderated. Older versions are skipped, since a later message
            // covers the newer one.
            let inference = match collection.as_deref() {
                Some(RouteRecord::NSID) => {
                    let Some(route) = fetch_route_moderation_view(pool, &uri)
                        .await?
                        .filter(|route| route.cid == cid)
                    else {
                        info!(uri, cid, "skipping labels for stale or deleted route");
                        return Ok(());
                    };
                    moderator
                        .infer_labels(
                            "route",
                            json!({
                                "name": route.name,
                                "description": route.description,
                                "tags": route.tags,
                            }),
                        )
                        .await?
                }
                Some(ReviewRecord::NSID) => {
                    // A review without a body is only a rating, so there is
                    // nothing to moderate.
                    let Some(body) = fetch_review_moderation_view(pool, &uri)
                        .await?
                        .filter(|review| review.cid == cid)
                        .and_then(|review| review.body)
                        .filter(|body| !body.trim().is_empty())
                    else {
                        info!(
                            uri,
                            cid, "skipping labels for stale, deleted or empty review"
                        );
                        return Ok(());
                    };
                    moderator
                        .infer_labels("review", json!({ "text": body }))
                        .await?
                }
                Some(ProfileRecord::NSID) => {
                    let Some(user) = fetch_user_moderation_view(pool, &uri)
                        .await?
                        .filter(|user| user.cid == cid)
                    else {
                        info!(uri, cid, "skipping labels for stale or deleted profile");
                        return Ok(());
                    };
                    moderator
                        .infer_labels("profile", json!({ "name": user.name, "bio": user.bio }))
                        .await?
                }
                _ => {
                    error!(uri, "discarding label request for unsupported collection");
                    return Ok(());
                }
            };

            if inference.labels.is_empty() {
                info!(uri, cid, "no labels applied");
                return Ok(());
            }

            let labels = NewLabels {
                uri,
                cid,
                vals: inference.labels.iter().map(ToString::to_string).collect(),
                cts: Timestamp::now(),
                source: inference.source.as_str().to_owned(),
            };
            database::labels::insert_labels(pool, &labels).await?;
            info!(uri = labels.uri, cid = labels.cid, vals = ?labels.vals, "labels applied");

            Ok(())
        })
        .await
}

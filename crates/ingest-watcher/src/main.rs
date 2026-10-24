use std::time::Duration;

use amqp::Queue::{Identity, Profiles, Reviews, Routes};
use atproto_tap::{TapEvent, TapStream};
use lapin::{Channel, protocol::constants::REPLY_SUCCESS};
use lifecycle::{
    health::{Readiness, Server, check},
    shutdown::Shutdown,
};
use tokio::time::{Instant, timeout, timeout_at};
use tokio_stream::StreamExt;
use tracing::{error, info, warn};
use tracing_subscriber::EnvFilter;

mod config;
mod tap;

/// Maximum number of buffered events processed after a shutdown signal.
const DRAIN_MAX_EVENTS: usize = tap::CHANNEL_BUFFER_SIZE;

/// Maximum time spent draining buffered events after a shutdown signal.
const DRAIN_TIMEOUT: Duration = Duration::from_secs(2);

/// Maximum time spent closing the Tap stream and `RabbitMQ` channel.
const SHUTDOWN_TIMEOUT: Duration = Duration::from_secs(10);

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    tracing_subscriber::fmt()
        .with_env_filter(
            EnvFilter::try_from_default_env().unwrap_or_else(|_| EnvFilter::new("info")),
        )
        .init();

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

    let channel = amqp::amqp_connect(&conf.rabbitmq_host).await?;
    amqp::declare_topology(&channel).await?;

    readiness.mark_started(vec![check("rabbitmq", amqp::health_check(&channel))]);

    let mut stream = tap::listen(&conf.tap_hostname, &conf.tap_admin_password);

    run(&mut stream, &channel, &mut shutdown).await;
    readiness.mark_draining();
    shutdown_gracefully(&mut stream, &channel).await;

    health.shutdown().await?;

    Ok(())
}

/// Process Tap events until a shutdown signal is received or the stream ends.
async fn run(stream: &mut TapStream, channel: &Channel, shutdown: &mut Shutdown) {
    loop {
        tokio::select! {
            biased;

            signal = shutdown.recv() => {
                info!(?signal, "shutdown signal received");
                break;
            }
            event = stream.next() => {
                match event {
                    Some(Ok(event)) => handle_event(&event, channel).await,
                    Some(Err(error)) => error!(%error, "failed to parse tap event"),
                    None => {
                        warn!("tap stream ended");
                        break;
                    }
                }
            }
        }
    }
}

/// Publish a single Tap event to the queue for its collection.
async fn handle_event(event: &TapEvent, channel: &Channel) {
    match event {
        TapEvent::Record { id, record } => {
            info!(id, "processing tap event");

            let queue = match record.collection.as_ref() {
                "app.attrails.v0.route" => Routes,
                "app.attrails.v0.review" => Reviews,
                "app.attrails.actor.profile" => Profiles,
                _ => {
                    warn!("ignoring event from unknown collection");
                    return;
                }
            };

            let payload = match serde_json::to_vec(record) {
                Ok(payload) => payload,
                Err(error) => {
                    error!(%error, "failed to serialise tap record event");
                    return;
                }
            };

            match queue.publish(&payload, channel).await {
                Ok(()) => info!(queue = queue.name(), "message published"),
                Err(error) => {
                    error!(
                        error = error.to_string(),
                        queue = queue.name(),
                        "failed to publish message"
                    );
                }
            }
        }
        TapEvent::Identity { id: _, identity } => {
            let payload = match serde_json::to_vec(identity) {
                Ok(payload) => payload,
                Err(error) => {
                    error!(%error, "failed to serialise tap identity event");
                    return;
                }
            };

            match Identity.publish(&payload, channel).await {
                Ok(()) => info!(queue = Identity.name(), "message published"),
                Err(error) => {
                    error!(
                        error = error.to_string(),
                        queue = Identity.name(),
                        "failed to publish message"
                    );
                }
            }
        }
    }
}

/// Process events that are already buffered in the Tap stream.
///
/// Tap acknowledges events before handing them to the stream, so these events
/// would otherwise be lost when the process exits.
async fn drain(stream: &mut TapStream, channel: &Channel) {
    let deadline = Instant::now() + DRAIN_TIMEOUT;
    let mut drained = 0;

    while drained < DRAIN_MAX_EVENTS {
        match timeout_at(deadline, stream.next()).await {
            Ok(Some(Ok(event))) => {
                handle_event(&event, channel).await;
                drained += 1;
            }
            Ok(Some(Err(error))) => {
                error!(%error, "failed to parse tap event during drain");
                drained += 1;
            }
            Ok(None) | Err(_) => break,
        }
    }

    info!(drained, "tap stream drained");
}

/// Drain, then close the Tap stream and `RabbitMQ` channel within a bounded
/// amount of time.
async fn shutdown_gracefully(stream: &mut TapStream, channel: &Channel) {
    let graceful = async {
        drain(stream, channel).await;
        stream.close().await;

        // A channel that is already reconnecting can not be closed; the
        // connection is torn down when the process exits.
        if channel.status().connected() {
            channel.close(REPLY_SUCCESS, "shutting down".into()).await?;
        }

        Ok::<(), lapin::Error>(())
    };

    match timeout(SHUTDOWN_TIMEOUT, graceful).await {
        Ok(Ok(())) => info!("graceful shutdown complete"),
        Ok(Err(error)) => error!(%error, "failed to close rabbitmq channel"),
        Err(_) => warn!("graceful shutdown timed out"),
    }
}

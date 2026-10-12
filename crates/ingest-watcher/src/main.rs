use amqp::Queue::{Profiles, Reviews, Routes};
use atproto_tap::{RecordAction, TapEvent};
use tokio_stream::StreamExt;
use tracing::{error, info, warn};
use tracing_subscriber::EnvFilter;

mod amqp;
mod config;
mod tap;

#[tokio::main]
async fn main() {
    tracing_subscriber::fmt()
        .with_env_filter(
            EnvFilter::try_from_default_env().unwrap_or_else(|_| EnvFilter::new("info")),
        )
        .init();

    let conf = config::Config::from_env().expect("failed to parse application config");

    let channel = amqp::amqp_connect(&conf.rabbitmq_host)
        .await
        .expect("failed to connect to rabbitmq");

    amqp::declare_topology(&channel)
        .await
        .expect("failed to declare rabbitmq topology");

    let mut stream = tap::listen(&conf.tap_hostname, &conf.tap_admin_password);
    while let Some(msg) = stream.next().await {
        match msg {
            Ok(msg) => match msg.as_ref() {
                TapEvent::Record { id, record } => {
                    let coll = record.collection.as_ref();
                    let rkey = record.rkey.as_str();
                    let action = record.action.to_string();

                    info!(
                        id = id,
                        action = action,
                        collection = coll,
                        rkey = rkey,
                        "received record event"
                    );

                    let Some(record) = record.record_value() else {
                        error!("failed to parse record value from tap event");
                        continue;
                    };

                    let queue = match coll {
                        "app.attrails.v0.route" => Routes,
                        "app.attrails.v0.review" => Reviews,
                        "app.attrails.actor.profile" => Profiles,
                        _ => {
                            warn!(collection = coll, "ignoring event from unknown collection");
                            continue;
                        }
                    };

                    match queue.publish(record, &channel).await {
                        Ok(_) => info!(queue = queue.name(), "message published"),
                        Err(e) => {
                            error!(
                                error = e.to_string(),
                                queue = queue.name(),
                                "failed to publish message"
                            );
                            continue;
                        }
                    }
                }
                TapEvent::Identity { id: _, identity: _ } => {
                    info!("ignoring identity event")
                }
            },
            Err(e) => {
                eprintln!("Failed to parse Tap event: {e}")
            }
        }
    }
}

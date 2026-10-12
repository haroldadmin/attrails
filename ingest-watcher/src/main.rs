use atproto_tap::TapEvent;
use tokio_stream::StreamExt;
use tracing_subscriber::EnvFilter;

mod amqp;
mod config;
mod tap;

#[tokio::main]
async fn main() {
    tracing_subscriber::fmt()
        .with_env_filter(
            EnvFilter::try_from_default_env().unwrap_or_else(|_| EnvFilter::new("debug")),
        )
        .init();

    let conf = config::Config::from_env().expect("failed to parse application config");

    let channel = amqp::amqp_connect(&conf.rabbitmq_host)
        .await
        .expect("failed to connect to rabbitmq");

    let topology = amqp::Topology::declare(&channel)
        .await
        .expect("failed to declare rabbitmq topology");

    let mut stream = tap::listen(&conf.tap_hostname, &conf.tap_admin_password);
    while let Some(msg) = stream.next().await {
        match msg {
            Ok(msg) => match msg.as_ref() {
                TapEvent::Record { id, record } => {
                    
                }
                TapEvent::Identity { id, identity } => {}
            },
            Err(e) => {
                eprintln!("Failed to parse Tap event: {e}")
            }
        }
    }
}

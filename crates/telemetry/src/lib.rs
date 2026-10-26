#![forbid(unsafe_code)]
#![deny(missing_docs)]

//! Logging and tracing setup for the `ATTrails` ingest services.
//!
//! [`init`] installs a global `tracing` subscriber that writes human-readable
//! logs to stdout, filtered by `RUST_LOG` (default `info`).
//!
//! When `OTEL_EXPORTER_OTLP_ENDPOINT` is set, spans are also exported as OTLP
//! traces and events as OTLP logs, over HTTP/protobuf. Logs emitted inside a
//! span carry its trace and span IDs. The SDK reads the service name and
//! resource attributes from `OTEL_SERVICE_NAME` and `OTEL_RESOURCE_ATTRIBUTES`.
//!
//! # Example
//!
//! ```no_run
//! # fn main() -> anyhow::Result<()> {
//! // Keep the guard alive for the whole process. Dropping it flushes
//! // buffered spans and logs.
//! let _telemetry = telemetry::init()?;
//! tracing::info!("started");
//! # Ok(())
//! # }
//! ```

use anyhow::Result;
use opentelemetry::{global, trace::TracerProvider};
use opentelemetry_appender_tracing::layer::OpenTelemetryTracingBridge;
use opentelemetry_otlp::{LogExporter, SpanExporter};
use opentelemetry_sdk::{
    Resource, logs::SdkLoggerProvider, propagation::TraceContextPropagator,
    trace::SdkTracerProvider,
};
use tracing::warn;
use tracing_subscriber::{EnvFilter, Layer, layer::SubscriberExt, util::SubscriberInitExt};

/// Targets that are never exported over OTLP. The exporter itself logs
/// through these crates, so exporting them would feed back into itself.
const EXPORTER_TARGETS: [&str; 5] = ["h2", "hyper", "opentelemetry", "reqwest", "tower"];

/// Flushes and shuts down the OTLP exporters when dropped.
#[must_use = "dropping the guard shuts down the OTLP exporters"]
pub struct Telemetry {
    providers: Option<(SdkTracerProvider, SdkLoggerProvider)>,
}

/// Install the global `tracing` subscriber.
///
/// # Errors
///
/// Returns an error if the OTLP exporters can not be built, or if
/// `RUST_LOG` contains an invalid directive.
pub fn init() -> Result<Telemetry> {
    let stdout = tracing_subscriber::fmt::layer().with_filter(env_filter());

    if std::env::var_os("OTEL_EXPORTER_OTLP_ENDPOINT").is_none() {
        tracing_subscriber::registry().with(stdout).init();
        return Ok(Telemetry { providers: None });
    }

    global::set_text_map_propagator(TraceContextPropagator::new());

    let resource = Resource::builder().build();
    let tracer_provider = SdkTracerProvider::builder()
        .with_resource(resource.clone())
        .with_batch_exporter(SpanExporter::builder().with_http().build()?)
        .build();
    let logger_provider = SdkLoggerProvider::builder()
        .with_resource(resource)
        .with_batch_exporter(LogExporter::builder().with_http().build()?)
        .build();

    let traces = tracing_opentelemetry::layer()
        .with_tracer(tracer_provider.tracer("attrails"))
        .with_filter(otlp_filter()?);
    let logs = OpenTelemetryTracingBridge::new(&logger_provider).with_filter(otlp_filter()?);

    tracing_subscriber::registry()
        .with(stdout)
        .with(traces)
        .with(logs)
        .init();

    Ok(Telemetry {
        providers: Some((tracer_provider, logger_provider)),
    })
}

impl Drop for Telemetry {
    fn drop(&mut self) {
        let Some((tracer_provider, logger_provider)) = self.providers.take() else {
            return;
        };

        if let Err(error) = tracer_provider.shutdown() {
            warn!(%error, "failed to shut down the trace exporter");
        }
        if let Err(error) = logger_provider.shutdown() {
            warn!(%error, "failed to shut down the log exporter");
        }
    }
}

fn env_filter() -> EnvFilter {
    EnvFilter::try_from_default_env().unwrap_or_else(|_| EnvFilter::new("info"))
}

fn otlp_filter() -> Result<EnvFilter> {
    let mut filter = env_filter();
    for target in EXPORTER_TARGETS {
        filter = filter.add_directive(format!("{target}=off").parse()?);
    }
    Ok(filter)
}

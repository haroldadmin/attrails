use std::{
    future::Future,
    net::{Ipv4Addr, SocketAddr},
    sync::{
        Arc, OnceLock,
        atomic::{AtomicBool, Ordering},
    },
    time::Duration,
};

use anyhow::Result;
use axum::{
    Json, Router,
    extract::State,
    http::{StatusCode, header},
    response::IntoResponse,
    routing::get,
};
use futures_util::future::{BoxFuture, join_all};
use serde::Serialize;
use tokio::{net::TcpListener, task::JoinHandle, time::timeout};
use tokio_util::sync::CancellationToken;
use tracing::{info, warn};

const LIVENESS_PATH: &str = "/health/live";
const READINESS_PATH: &str = "/health/ready";
const CHECK_TIMEOUT: Duration = Duration::from_secs(2);

/// A named readiness check and the closure that evaluates it.
pub type Check = (
    &'static str,
    Box<dyn Fn() -> BoxFuture<'static, Result<()>> + Send + Sync>,
);

/// Create a named readiness check.
#[must_use]
pub fn check<F, Fut>(name: &'static str, f: F) -> Check
where
    F: Fn() -> Fut + Send + Sync + 'static,
    Fut: Future<Output = Result<()>> + Send + 'static,
{
    (name, Box::new(move || Box::pin(f())))
}

/// Shared readiness state exposed by the readiness probe.
#[derive(Clone, Default)]
pub struct Readiness {
    inner: Arc<Inner>,
}

#[derive(Default)]
struct Inner {
    draining: AtomicBool,
    checks: OnceLock<Vec<Check>>,
}

impl Readiness {
    /// Create a readiness state that reports `503` until
    /// [`Self::mark_started`] is called.
    #[must_use]
    pub fn new() -> Self {
        Self::default()
    }

    /// Mark startup as complete and install the readiness checks.
    ///
    /// Only the first call has an effect.
    pub fn mark_started(&self, checks: impl IntoIterator<Item = Check>) {
        let _ = self.inner.checks.set(checks.into_iter().collect());
    }

    /// Mark the process as draining.
    ///
    /// Readiness stays false for the remainder of the process lifetime.
    pub fn mark_draining(&self) {
        self.inner.draining.store(true, Ordering::Release);
    }

    async fn evaluate(&self) -> ReadinessReport {
        if self.inner.draining.load(Ordering::Acquire) {
            return ReadinessReport::unavailable(NotReadyReason::Draining);
        }

        let Some(checks) = self.inner.checks.get() else {
            return ReadinessReport::unavailable(NotReadyReason::Starting);
        };

        let reports = join_all(checks.iter().map(|(name, check)| {
            let name = *name;

            async move {
                match timeout(CHECK_TIMEOUT, check()).await {
                    Ok(Ok(())) => CheckReport::ok(name),
                    Ok(Err(error)) => {
                        warn!(check = name, %error, "readiness check failed");
                        CheckReport::unavailable(name, error.to_string())
                    }
                    Err(_) => {
                        warn!(check = name, "readiness check timed out");
                        CheckReport::unavailable(name, "timed out".to_string())
                    }
                }
            }
        }))
        .await;

        ReadinessReport::from_checks(reports)
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "snake_case")]
enum Status {
    Ok,
    Unavailable,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "snake_case")]
enum NotReadyReason {
    Starting,
    Draining,
}

#[derive(Debug, Serialize)]
struct CheckReport {
    name: &'static str,
    status: Status,
    #[serde(skip_serializing_if = "Option::is_none")]
    error: Option<String>,
}

impl CheckReport {
    fn ok(name: &'static str) -> Self {
        Self {
            name,
            status: Status::Ok,
            error: None,
        }
    }

    fn unavailable(name: &'static str, error: String) -> Self {
        Self {
            name,
            status: Status::Unavailable,
            error: Some(error),
        }
    }
}

#[derive(Debug, Serialize)]
struct ReadinessReport {
    status: Status,
    #[serde(skip_serializing_if = "Option::is_none")]
    reason: Option<NotReadyReason>,
    #[serde(skip_serializing_if = "Vec::is_empty")]
    checks: Vec<CheckReport>,
}

impl ReadinessReport {
    fn is_ready(&self) -> bool {
        self.status == Status::Ok
    }

    fn from_checks(checks: Vec<CheckReport>) -> Self {
        let ready = checks.iter().all(|check| check.status == Status::Ok);

        Self {
            status: if ready {
                Status::Ok
            } else {
                Status::Unavailable
            },
            reason: None,
            checks,
        }
    }

    fn unavailable(reason: NotReadyReason) -> Self {
        Self {
            status: Status::Unavailable,
            reason: Some(reason),
            checks: Vec::new(),
        }
    }
}

/// Handle for a running probe server.
pub struct Server {
    local_addr: SocketAddr,
    stop: CancellationToken,
    task: JoinHandle<std::io::Result<()>>,
}

impl Server {
    /// Bind to `0.0.0.0:port` and start serving probes.
    ///
    /// # Errors
    ///
    /// Returns an error if the listener can not be bound.
    ///
    /// # Panics
    ///
    /// Panics if called outside a Tokio runtime.
    pub async fn bind(port: u16, readiness: Readiness) -> std::io::Result<Self> {
        let listener = TcpListener::bind((Ipv4Addr::UNSPECIFIED, port)).await?;
        let local_addr = listener.local_addr()?;
        info!(address = %local_addr, "health probe server listening");

        let app = Router::new()
            .route(LIVENESS_PATH, get(live))
            .route(READINESS_PATH, get(ready))
            .with_state(readiness);

        let stop = CancellationToken::new();
        let stop_rx = stop.clone();

        let task = tokio::spawn(async move {
            axum::serve(listener, app)
                .with_graceful_shutdown(stop_rx.cancelled_owned())
                .await
        });

        Ok(Self {
            local_addr,
            stop,
            task,
        })
    }

    /// Return the address the probe server is bound to.
    #[must_use]
    pub fn local_addr(&self) -> SocketAddr {
        self.local_addr
    }

    /// Stop the server and wait for it to exit.
    ///
    /// # Errors
    ///
    /// Returns an error if the HTTP server failed or its task panicked.
    pub async fn shutdown(self) -> Result<()> {
        self.stop.cancel();
        self.task.await??;
        Ok(())
    }
}

async fn live() -> impl IntoResponse {
    ([(header::CACHE_CONTROL, "no-store")], "ok")
}

async fn ready(State(readiness): State<Readiness>) -> impl IntoResponse {
    let report = readiness.evaluate().await;
    let status = if report.is_ready() {
        StatusCode::OK
    } else {
        StatusCode::SERVICE_UNAVAILABLE
    };

    (status, [(header::CACHE_CONTROL, "no-store")], Json(report))
}

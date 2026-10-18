use std::sync::{
    Arc, PoisonError, RwLock,
    atomic::{AtomicBool, Ordering},
};

use axum::{Router, extract::State, http::StatusCode, routing::get};
use tokio::{net::TcpListener, sync::oneshot, task::JoinHandle};
use tracing::error;

type DependencyCheck = Arc<dyn Fn() -> bool + Send + Sync>;

/// Shared readiness state exposed by the `/health/ready` probe.
///
/// Readiness requires that startup has completed, that the dependency check
/// currently passes, and that the process is not shutting down.
#[derive(Clone)]
pub struct Readiness {
    inner: Arc<Inner>,
}

struct Inner {
    started: AtomicBool,
    draining: AtomicBool,
    check: RwLock<DependencyCheck>,
}

impl Readiness {
    /// Create a readiness state that is not ready until [`Self::mark_started`]
    /// is called and a dependency check is installed with [`Self::set_check`].
    #[must_use]
    pub fn new() -> Self {
        Self {
            inner: Arc::new(Inner {
                started: AtomicBool::new(false),
                draining: AtomicBool::new(false),
                check: RwLock::new(Arc::new(|| false)),
            }),
        }
    }

    /// Install the dependency check used by the readiness probe.
    ///
    /// The check should be cheap and must not block, since it runs on the
    /// probe request path.
    pub fn set_check(&self, check: impl Fn() -> bool + Send + Sync + 'static) {
        *self
            .inner
            .check
            .write()
            .unwrap_or_else(PoisonError::into_inner) = Arc::new(check);
    }

    /// Mark startup as complete.
    pub fn mark_started(&self) {
        self.inner.started.store(true, Ordering::Release);
    }

    /// Mark the process as draining.
    ///
    /// Readiness stays false for the remainder of the process lifetime.
    pub fn mark_draining(&self) {
        self.inner.draining.store(true, Ordering::Release);
    }

    /// Return whether the process is currently ready to do work.
    #[must_use]
    pub fn is_ready(&self) -> bool {
        if !self.inner.started.load(Ordering::Acquire)
            || self.inner.draining.load(Ordering::Acquire)
        {
            return false;
        }

        let check = self
            .inner
            .check
            .read()
            .unwrap_or_else(PoisonError::into_inner)
            .clone();

        check()
    }
}

impl Default for Readiness {
    fn default() -> Self {
        Self::new()
    }
}

/// Handle for the running health probe server.
pub struct HealthHandle {
    stop: oneshot::Sender<()>,
    task: JoinHandle<()>,
}

impl HealthHandle {
    /// Stop accepting probe requests and wait for the server to exit.
    pub async fn shutdown(self) {
        let _ = self.stop.send(());
        let _ = self.task.await;
    }
}

/// Serve liveness and readiness probes on an already bound listener.
///
/// The caller binds the listener so that the actual address can be logged and
/// tests can bind an ephemeral port.
#[must_use]
pub fn spawn(listener: TcpListener, readiness: Readiness) -> HealthHandle {
    let app = Router::new()
        .route("/health/live", get(live))
        .route("/health/ready", get(ready))
        .with_state(readiness);

    let (stop, stop_rx) = oneshot::channel();

    let task = tokio::spawn(async move {
        let served = axum::serve(listener, app)
            .with_graceful_shutdown(async {
                let _ = stop_rx.await;
            })
            .await;

        if let Err(error) = served {
            error!(%error, "health probe server failed");
        }
    });

    HealthHandle { stop, task }
}

async fn live() -> (StatusCode, &'static str) {
    (StatusCode::OK, "ok")
}

async fn ready(State(readiness): State<Readiness>) -> (StatusCode, &'static str) {
    if readiness.is_ready() {
        (StatusCode::OK, "ok")
    } else {
        (StatusCode::SERVICE_UNAVAILABLE, "not ready")
    }
}

#[cfg(test)]
mod tests {
    use super::Readiness;

    #[test]
    fn readiness_requires_startup_and_dependency_check() {
        let readiness = Readiness::new();
        assert!(!readiness.is_ready());

        readiness.mark_started();
        assert!(!readiness.is_ready(), "default check reports not ready");

        readiness.set_check(|| true);
        assert!(readiness.is_ready());

        readiness.set_check(|| false);
        assert!(!readiness.is_ready());
    }

    #[test]
    fn readiness_is_false_while_draining() {
        let readiness = Readiness::new();
        readiness.set_check(|| true);
        readiness.mark_started();
        assert!(readiness.is_ready());

        readiness.mark_draining();
        assert!(!readiness.is_ready());
    }
}

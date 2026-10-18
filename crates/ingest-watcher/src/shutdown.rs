use anyhow::Result;
use tokio::signal::unix::{Signal as UnixSignal, SignalKind};

/// A signal that triggers graceful shutdown.
#[derive(Debug, Clone, Copy)]
pub enum ShutdownSignal {
    Interrupt,
    Terminate,
}

/// Handlers for the shutdown signals this process responds to.
pub struct Shutdown {
    interrupt: UnixSignal,
    terminate: UnixSignal,
}

impl Shutdown {
    /// Install handlers for `SIGINT` and `SIGTERM`.
    ///
    /// Handlers are registered immediately so that signals received while the
    /// application is still starting up are not handled by the default
    /// disposition.
    ///
    /// # Errors
    ///
    /// Returns an error if a signal handler can not be installed.
    pub fn new() -> Result<Self> {
        Ok(Self {
            interrupt: tokio::signal::unix::signal(SignalKind::interrupt())?,
            terminate: tokio::signal::unix::signal(SignalKind::terminate())?,
        })
    }

    /// Wait for the next shutdown signal.
    pub async fn recv(&mut self) -> ShutdownSignal {
        tokio::select! {
            _ = self.interrupt.recv() => ShutdownSignal::Interrupt,
            _ = self.terminate.recv() => ShutdownSignal::Terminate,
        }
    }
}

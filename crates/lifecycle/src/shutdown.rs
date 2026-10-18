use tokio::signal::unix::{Signal as UnixSignal, SignalKind};

/// A signal that requests graceful shutdown.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ShutdownSignal {
    /// `SIGINT`, typically sent by an interactive interrupt.
    Interrupt,
    /// `SIGTERM`, typically sent by a process supervisor.
    Terminate,
}

/// Handlers for the shutdown signals this process responds to.
///
/// Handlers are registered when the value is constructed. Registering early
/// ensures that a signal received during startup is buffered instead of being
/// handled by the default disposition.
///
/// This type is Unix-only.
pub struct Shutdown {
    interrupt: UnixSignal,
    terminate: UnixSignal,
}

impl Shutdown {
    /// Install handlers for `SIGINT` and `SIGTERM`.
    ///
    /// # Errors
    ///
    /// Returns an error if a signal handler can not be installed.
    pub fn new() -> std::io::Result<Self> {
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

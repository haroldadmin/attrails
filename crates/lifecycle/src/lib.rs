#![forbid(unsafe_code)]
#![deny(missing_docs)]

//! Process lifecycle primitives for the `ATTrails` ingest services.
//!
//! This crate provides two building blocks:
//!
//! - [`health`]: liveness and readiness probes backed by named, asynchronous
//!   dependency checks.
//! - [`shutdown`]: `SIGINT` and `SIGTERM` handling.
//!
//! The crate deliberately knows nothing about a specific application. The
//! host registers its own checks and orchestrates its own shutdown sequence.
//!
//! # Example
//!
//! ```no_run
//! use lifecycle::health::{Readiness, Server, check};
//! use lifecycle::shutdown::Shutdown;
//!
//! # async fn run() -> Result<(), Box<dyn std::error::Error>> {
//! let readiness = Readiness::new();
//! readiness.mark_started(vec![check("database", || async { Ok(()) })]);
//!
//! let probes = Server::bind(8080, readiness.clone()).await?;
//!
//! let mut shutdown = Shutdown::new()?;
//! shutdown.recv().await;
//!
//! // Stop reporting ready before draining, then close the probe server once
//! // the application has finished shutting down.
//! readiness.mark_draining();
//! probes.shutdown().await?;
//! # Ok(())
//! # }
//! ```
//!
//! # Probe semantics
//!
//! - Liveness always returns `200` while the probe server is running. It does
//!   not check dependencies and is intended to answer "is this process alive?".
//! - Readiness returns `200` only when startup has completed, the process is
//!   not draining, and every registered check passes. It returns `503`
//!   otherwise.
//!
//! Checks run on every readiness request and are executed concurrently. They
//! must be cheap and must not block the runtime. Each check is bounded by a two
//! second timeout.
//!
//! # Shutdown contract
//!
//! Calling [`health::Readiness::mark_draining`] makes readiness return `503`
//! for the rest of the process lifetime. Hosts should call it as soon as a
//! shutdown signal is received, before they begin draining work.

/// Liveness and readiness probe support.
pub mod health;

/// Graceful shutdown signal handling.
pub mod shutdown;

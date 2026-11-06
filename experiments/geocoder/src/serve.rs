//! A minimal HTTP API: `GET /search?q=...&lat=..&lon=..&limit=..`.
//!
//! Searches are synchronous and take well under a millisecond of CPU, so
//! they run inline on a two-thread runtime.

use std::path::Path;
use std::sync::Arc;
use std::time::Instant;

use anyhow::Result;
use axum::extract::{Query, State};
use axum::{Json, Router, routing::get};
use serde::{Deserialize, Serialize};

use crate::index::{Hit, Index};

#[derive(Deserialize)]
struct Params {
    q: String,
    lat: Option<f64>,
    lon: Option<f64>,
    limit: Option<usize>,
}

#[derive(Serialize)]
struct Response {
    results: Vec<Hit>,
    took_us: u128,
}

async fn search(State(idx): State<Arc<Index>>, Query(p): Query<Params>) -> Json<Response> {
    let start = Instant::now();
    let focus = p.lat.zip(p.lon);
    let results = idx.search(&crate::index::Query {
        text: &p.q,
        focus,
        limit: p.limit.unwrap_or(8).min(20),
    });
    Json(Response {
        results,
        took_us: start.elapsed().as_micros(),
    })
}

pub fn run(dir: &Path, addr: &str) -> Result<()> {
    let idx = Arc::new(Index::open(dir)?);
    eprintln!("serve: {} places, listening on {addr}", idx.len());
    let app = Router::new()
        .route("/search", get(search))
        .route("/health", get(|| async { "ok" }))
        .with_state(idx);
    tokio::runtime::Builder::new_multi_thread()
        .worker_threads(2)
        .enable_all()
        .build()?
        .block_on(async {
            let listener = tokio::net::TcpListener::bind(addr).await?;
            axum::serve(listener, app).await?;
            Ok(())
        })
}

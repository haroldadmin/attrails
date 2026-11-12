//! HTTP server: serve <index> [addr]
//!
//! `GET /api?q=<text>&lat=<lat>&lon=<lon>&limit=<n>` answers with a GeoJSON
//! FeatureCollection shaped like Photon's, so clients written for Photon work.

use std::path::Path;
use std::sync::Arc;

use axum::extract::{Query as Params, State};
use axum::routing::get;
use axum::{Json, Router};
use geocoder::index::Index;
use geocoder::search::{Query, search};
use serde::Deserialize;
use serde_json::{Value, json};

#[derive(Deserialize)]
struct Api {
    q: String,
    lat: Option<f64>,
    lon: Option<f64>,
    limit: Option<usize>,
}

async fn api(State(index): State<Arc<Index>>, Params(p): Params<Api>) -> Json<Value> {
    // Page faults on a cold index block, so keep queries off the async workers.
    let body = tokio::task::spawn_blocking(move || {
        let near = p.lat.zip(p.lon).filter(|(lat, lon)| lat.abs() <= 90.0 && lon.abs() <= 180.0);
        let limit = p.limit.unwrap_or(8).clamp(1, 20);
        let hits = search(&index, &Query { text: &p.q, near, limit });
        let features: Vec<Value> = hits
            .iter()
            .map(|h| {
                let d = h.doc as usize;
                let (local, en) = index.names(h.doc);
                let (key, value) = index.meta.kinds[index.kind()[d] as usize].split_once('=').unwrap_or(("", ""));
                let osm = index.osm()[d];
                let cc = index.country()[d];
                json!({
                    "type": "Feature",
                    "geometry": { "type": "Point", "coordinates": [f64::from(index.lon()[d]) / 1e7, f64::from(index.lat()[d]) / 1e7] },
                    "properties": {
                        "name": local,
                        "name_en": en,
                        "osm_key": key,
                        "osm_value": value,
                        "osm_type": char::from((osm >> 56) as u8).to_string(),
                        "osm_id": osm & 0x00ff_ffff_ffff_ffff,
                        "countrycode": String::from_utf8_lossy(&cc).to_uppercase(),
                        "context": index.context_label(index.context()[d]),
                        "extent": index.bbox()[d],
                        "distance_km": h.distance_km,
                    }
                })
            })
            .collect();
        json!({ "type": "FeatureCollection", "features": features })
    })
    .await
    .unwrap_or_else(|_| json!({ "type": "FeatureCollection", "features": [] }));
    Json(body)
}

fn main() -> anyhow::Result<()> {
    let args: Vec<String> = std::env::args().collect();
    let index = Arc::new(Index::open(Path::new(&args[1]))?);
    let addr = args
        .get(2)
        .map_or("0.0.0.0:2322", String::as_str)
        .to_string();
    let runtime = tokio::runtime::Builder::new_multi_thread()
        .worker_threads(2)
        .max_blocking_threads(4)
        .enable_all()
        .build()?;
    runtime.block_on(async move {
        let app = Router::new()
            .route("/api", get(api))
            .route("/health", get(|| async { "ok" }))
            .with_state(index);
        let listener = tokio::net::TcpListener::bind(&addr).await?;
        eprintln!("listening on {addr}");
        axum::serve(listener, app).await?;
        Ok(())
    })
}

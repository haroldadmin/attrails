//! Latency and recall benchmark.
//!
//! Simulates search-as-you-type: pick a place, then query every prefix of
//! its name the way a user would type it (each keystroke is a request).
//! Half of the places are drawn from the top 20k (the places most people
//! look for), half uniformly from the whole index (the long tail). Half of
//! the queries carry a location bias, as ATTrails gets one from Cloudflare.
//!
//! Recall: when the full name is typed with a focus within ~30 km of the
//! place, is it in the top 5?

use std::path::Path;
use std::time::{Duration, Instant};

use anyhow::Result;
use rand::{Rng, SeedableRng, rngs::StdRng};

use crate::index::{Hit, Index, Query};
use crate::tantivy_engine::TantivyEngine;

struct Case {
    text: String,
    focus: Option<(f64, f64)>,
    target: String,
    full: bool,
}

fn cases(idx: &Index, n: usize) -> Vec<Case> {
    let mut rng = StdRng::seed_from_u64(42);
    let mut out = Vec::with_capacity(n);
    while out.len() < n {
        let id = if rng.random_bool(0.5) {
            rng.random_range(0..idx.len().min(20_000))
        } else {
            rng.random_range(0..idx.len())
        };
        let (name, osm, lat, lon) = idx.name_of(id);
        let focus = rng.random_bool(0.5).then(|| {
            // Cloudflare's location is city-level; jitter by up to ~30 km.
            (
                f64::from(lat) + rng.random_range(-0.25..0.25),
                f64::from(lon) + rng.random_range(-0.25..0.25),
            )
        });
        let chars: Vec<char> = name.chars().collect();
        for len in 1..=chars.len() {
            out.push(Case {
                text: chars[..len].iter().collect(),
                focus,
                target: osm.clone(),
                full: len == chars.len(),
            });
        }
    }
    out.truncate(n);
    out
}

fn pct(sorted: &[Duration], p: f64) -> Duration {
    #[allow(
        clippy::cast_possible_truncation,
        clippy::cast_sign_loss,
        clippy::cast_precision_loss
    )]
    let i = ((sorted.len() as f64 - 1.0) * p).round() as usize;
    sorted[i]
}

/// Benchmarks the custom index in `dir`, or the Tantivy index in `tantivy`
/// when given. Queries are always generated from the custom index so both
/// engines answer exactly the same ones.
pub fn run(dir: &Path, n: usize, threads: usize, tantivy: Option<&Path>) -> Result<()> {
    let start = Instant::now();
    let idx = Index::open(dir)?;
    eprintln!(
        "bench: opened {} places in {:?}",
        idx.len(),
        start.elapsed()
    );
    let cases = cases(&idx, n);
    let tantivy = tantivy.map(TantivyEngine::open).transpose()?;
    if let Some(t) = &tantivy {
        eprintln!("bench: tantivy engine, {} segment(s)", t.segments());
    }
    let search = |q: &Query<'_>| -> Vec<Hit> {
        match &tantivy {
            Some(t) => t.search(q),
            None => idx.search(q),
        }
    };
    let chunk = cases.len().div_ceil(threads);
    let wall = Instant::now();
    let results: Vec<(Duration, bool, bool)> = std::thread::scope(|s| {
        let handles: Vec<_> = cases
            .chunks(chunk)
            .map(|part| {
                let search = &search;
                s.spawn(move || {
                    part.iter()
                        .map(|c| {
                            let t = Instant::now();
                            let hits = search(&Query {
                                text: &c.text,
                                focus: c.focus,
                                limit: 5,
                            });
                            let found = hits.iter().any(|h| h.osm == c.target);
                            (t.elapsed(), c.full && c.focus.is_some(), found)
                        })
                        .collect::<Vec<_>>()
                })
            })
            .collect();
        handles
            .into_iter()
            .flat_map(|h| h.join().expect("bench thread"))
            .collect()
    });
    let wall = wall.elapsed();
    let mut lat: Vec<Duration> = results.iter().map(|r| r.0).collect();
    lat.sort_unstable();
    let full: Vec<_> = results.iter().filter(|r| r.1).collect();
    let found = full.iter().filter(|r| r.2).count();
    #[allow(clippy::cast_precision_loss)]
    {
        println!(
            "queries: {}  threads: {threads}  wall: {wall:?}  throughput: {:.0} q/s",
            lat.len(),
            lat.len() as f64 / wall.as_secs_f64()
        );
        println!(
            "latency  p50: {:?}  p95: {:?}  p99: {:?}  max: {:?}",
            pct(&lat, 0.5),
            pct(&lat, 0.95),
            pct(&lat, 0.99),
            lat[lat.len() - 1]
        );
        println!(
            "recall@5 (full name typed, focus nearby): {found}/{} = {:.1}%",
            full.len(),
            100.0 * found as f64 / full.len() as f64
        );
    }
    Ok(())
}

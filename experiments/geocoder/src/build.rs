//! Stage 2: turn filtered records into a read-only, memory-mappable index.
//!
//! Layout of the index directory:
//!
//! - `docs.bin`: one fixed 20-byte record per place, ordered by importance
//!   (doc id 0 is the most important place). Holds the centroid, kind,
//!   quantised importance and offsets into `payload.bin` and `contexts.bin`.
//! - `payload.bin`: per-place display name, OSM id, bbox and normalised names.
//! - `contexts.bin`: de-duplicated "City, State, Country" labels (millions of
//!   places share a handful of contexts).
//! - `terms.fst` + `postings.bin`: an FST mapping keys to delta-varint doc id
//!   lists. Because doc ids follow importance, every posting list is already
//!   in rank order, so reading the first N ids gives the N best matches.
//!   Keys are:
//!   - `T` + token: every place with that name token.
//!   - `P` + prefix: the top places for each 1..=3 character prefix, so a
//!     one-letter query never has to expand a million terms.
//!   - `G` + cell + token and `Q` + cell + prefix: the same, per 2 degree grid
//!     cell, so places near the user surface even when they are not globally
//!     important.

use std::collections::{HashMap, HashSet};
use std::fs::File;
use std::io::{BufRead, BufReader, BufWriter, Write};
use std::path::Path;

use anyhow::{Context, Result};
use serde::{Deserialize, Serialize};

use crate::filter::{Item, Record};
use crate::normalize::{char_prefix, tokens};

pub const DOC_SIZE: usize = 20;
pub const PREFIX_CACHE_CHARS: usize = 3;
pub const PREFIX_CACHE_GLOBAL: usize = 256;
pub const PREFIX_CACHE_LOCAL: usize = 128;
pub const CELL_DEG: f64 = 2.0;
const CLUSTER_DEG: f64 = 0.05;

#[derive(Serialize, Deserialize)]
pub struct Meta {
    pub docs: u32,
    pub kinds: Vec<String>,
    pub countries: HashMap<String, String>,
}

/// The 2 degree grid cell a coordinate falls in.
#[allow(clippy::cast_possible_truncation, clippy::cast_sign_loss)]
pub fn cell(lat: f64, lon: f64) -> u16 {
    let y = ((lat + 90.0) / CELL_DEG).floor().clamp(0.0, 89.0) as u16;
    let x = ((lon + 180.0) / CELL_DEG).floor().clamp(0.0, 179.0) as u16;
    y * 180 + x
}

pub fn write_varint(out: &mut Vec<u8>, mut v: u64) {
    while v >= 0x80 {
        out.push((v as u8) | 0x80);
        v >>= 7;
    }
    out.push(v as u8);
}

fn write_str(out: &mut Vec<u8>, s: &str) {
    write_varint(out, s.len() as u64);
    out.extend_from_slice(s.as_bytes());
}

/// Places that come in many pieces (river segments, path ways, a peak as
/// both node and area) get merged when they share a name and kind and sit
/// within a few kilometres of each other.
fn clusterable(kind: &str) -> bool {
    let (key, value) = kind.split_once('=').unwrap_or((kind, ""));
    !matches!(
        key,
        "place" | "railway" | "aerialway" | "tourism" | "historic" | "mountain_pass"
    ) && !matches!(value, "administrative" | "peak" | "volcano" | "saddle")
}

fn find(parent: &mut [usize], mut i: usize) -> usize {
    while parent[i] != i {
        parent[i] = parent[parent[i]];
        i = parent[i];
    }
    i
}

#[allow(clippy::cast_possible_truncation)]
pub fn cluster(records: Vec<Record>) -> Vec<Record> {
    let mut groups: HashMap<(String, String), Vec<usize>> = HashMap::new();
    for (i, r) in records.iter().enumerate() {
        if clusterable(&r.kind) {
            groups
                .entry((tokens(&r.name).join(" "), r.kind.clone()))
                .or_default()
                .push(i);
        }
    }
    let mut parent: Vec<usize> = (0..records.len()).collect();
    for members in groups.values().filter(|m| m.len() > 1) {
        let mut grid: HashMap<(i32, i32), Vec<usize>> = HashMap::new();
        for &i in members {
            let r = &records[i];
            let (gy, gx) = ((r.lat / CLUSTER_DEG) as i32, (r.lon / CLUSTER_DEG) as i32);
            for dy in -1..=1 {
                for dx in -1..=1 {
                    for &j in grid.get(&(gy + dy, gx + dx)).into_iter().flatten() {
                        let (a, b) = (find(&mut parent, i), find(&mut parent, j));
                        parent[a] = b;
                    }
                }
            }
            grid.entry((gy, gx)).or_default().push(i);
        }
    }
    // Keep the most important member of each cluster and grow its bbox.
    let mut best: HashMap<usize, usize> = HashMap::new();
    for i in 0..records.len() {
        let root = find(&mut parent, i);
        let e = best.entry(root).or_insert(i);
        if records[i].importance > records[*e].importance {
            *e = i;
        }
    }
    let mut bboxes: HashMap<usize, [f32; 4]> = HashMap::new();
    for i in 0..records.len() {
        let root = find(&mut parent, i);
        let r = &records[i];
        let b = r
            .bbox
            .unwrap_or([r.lon as f32, r.lat as f32, r.lon as f32, r.lat as f32]);
        let e = bboxes.entry(root).or_insert(b);
        *e = [
            e[0].min(b[0]),
            e[1].min(b[1]),
            e[2].max(b[2]),
            e[3].max(b[3]),
        ];
    }
    let mut keep: Vec<(usize, usize)> = best.into_iter().collect();
    keep.sort_unstable();
    let mut records: Vec<Option<Record>> = records.into_iter().map(Some).collect();
    keep.into_iter()
        .map(|(root, i)| {
            let mut r = records[i].take().expect("each record is kept once");
            let b = bboxes[&root];
            if b[0] != b[2] || b[1] != b[3] {
                r.bbox = Some(b);
            }
            r
        })
        .collect()
}

pub fn context_label(r: &Record, countries: &HashMap<String, String>) -> String {
    let mut parts: Vec<String> = Vec::new();
    let mut add = |s: Option<&str>| {
        if let Some(s) = s.filter(|s| *s != r.name && !parts.iter().any(|p| p == s)) {
            parts.push(s.to_owned());
        }
    };
    add(r.city.as_deref());
    if r.city.is_none() {
        add(r.county.as_deref());
    }
    add(r.state.as_deref());
    add(r
        .cc
        .as_deref()
        .and_then(|cc| countries.get(cc))
        .map(String::as_str));
    parts.join(", ")
}

/// Builds the index in `out_dir` from filtered record files.
#[allow(
    clippy::too_many_lines,
    clippy::cast_possible_truncation,
    clippy::cast_sign_loss
)]
/// Searchable context: the label, local names ("Tirol" for "Tyrol") and the
/// country code, normalised.
pub fn context_norm(r: &Record, label: &str) -> String {
    let mut norm = tokens(label);
    for alt in &r.context_alt {
        norm.extend(tokens(alt));
    }
    norm.extend(r.cc.clone());
    norm.join(" ")
}

/// Loads filtered records from `.parquet` or `.jsonl.zst` files, merges
/// duplicates and sorts them by importance (most important first).
pub fn load(inputs: &[String]) -> Result<(Vec<Record>, HashMap<String, String>)> {
    let start = std::time::Instant::now();
    let mut records = Vec::new();
    let mut countries = HashMap::new();
    for input in inputs {
        if input.ends_with(".parquet") {
            let (r, c) = crate::parquet_io::read(Path::new(input))?;
            records.extend(r);
            countries.extend(c);
            continue;
        }
        let f = File::open(input).with_context(|| format!("opening {input}"))?;
        for line in BufReader::new(zstd::Decoder::new(f)?).lines() {
            match serde_json::from_str::<Item>(&line?)? {
                Item::Countries { names } => countries.extend(names),
                Item::Place(r) => records.push(r),
            }
        }
    }
    let loaded = records.len();
    eprintln!("load: {loaded} records read in {:?}", start.elapsed());
    let mut records = cluster(records);
    eprintln!("load: {} after clustering", records.len());
    records.sort_by(|a, b| b.importance.total_cmp(&a.importance));
    Ok((records, countries))
}

pub fn run(out_dir: &Path, inputs: &[String]) -> Result<()> {
    std::fs::create_dir_all(out_dir)?;
    let (records, countries) = load(inputs)?;

    let mut kinds: Vec<String> = Vec::new();
    let mut kind_ids: HashMap<String, u16> = HashMap::new();
    let mut contexts: HashMap<(String, String), u32> = HashMap::new();
    let mut ctx_bytes = Vec::new();
    let mut docs = Vec::with_capacity(records.len() * DOC_SIZE);
    let mut payload = Vec::new();
    let mut keys: HashMap<Vec<u8>, Vec<u32>> = HashMap::new();

    for (id, r) in records.iter().enumerate() {
        let id = id as u32;
        let kind = *kind_ids.entry(r.kind.clone()).or_insert_with(|| {
            kinds.push(r.kind.clone());
            (kinds.len() - 1) as u16
        });
        let label = context_label(r, &countries);
        let norm = context_norm(r, &label);
        let ctx = *contexts
            .entry((label.clone(), norm.clone()))
            .or_insert_with(|| {
                let off = ctx_bytes.len() as u32;
                write_str(&mut ctx_bytes, &label);
                write_str(&mut ctx_bytes, &norm);
                off
            });

        let p_off = payload.len() as u32;
        payload.push(u8::from(r.bbox.is_some()));
        if let Some(b) = r.bbox {
            for v in b {
                payload.extend_from_slice(&v.to_le_bytes());
            }
        }
        write_str(&mut payload, &r.name);
        write_str(&mut payload, &r.osm);
        let mut all_tokens: HashSet<String> = HashSet::new();
        let mut norm_names: Vec<String> = Vec::new();
        for n in &r.names {
            let t = tokens(n);
            if t.is_empty() {
                continue;
            }
            let joined = t.join(" ");
            if !norm_names.contains(&joined) {
                norm_names.push(joined);
            }
            all_tokens.extend(t);
        }
        write_varint(&mut payload, norm_names.len() as u64);
        for n in &norm_names {
            write_str(&mut payload, n);
        }

        docs.extend_from_slice(&(r.lat as f32).to_le_bytes());
        docs.extend_from_slice(&(r.lon as f32).to_le_bytes());
        docs.extend_from_slice(&p_off.to_le_bytes());
        docs.extend_from_slice(&ctx.to_le_bytes());
        docs.extend_from_slice(&kind.to_le_bytes());
        let imp = (r.importance.clamp(0.0, 1.0) * f32::from(u16::MAX)) as u16;
        docs.extend_from_slice(&imp.to_le_bytes());

        let c = cell(r.lat, r.lon).to_be_bytes();
        let mut prefixes: HashSet<&str> = HashSet::new();
        for t in &all_tokens {
            for n in 1..=PREFIX_CACHE_CHARS {
                if let Some(p) = char_prefix(t, n) {
                    prefixes.insert(p);
                }
            }
            keys.entry([b"T", t.as_bytes()].concat())
                .or_default()
                .push(id);
            keys.entry([&b"G"[..], &c, t.as_bytes()].concat())
                .or_default()
                .push(id);
        }
        for p in prefixes {
            let g = keys.entry([b"P", p.as_bytes()].concat()).or_default();
            if g.len() < PREFIX_CACHE_GLOBAL {
                g.push(id);
            }
            let l = keys
                .entry([&b"Q"[..], &c, p.as_bytes()].concat())
                .or_default();
            if l.len() < PREFIX_CACHE_LOCAL {
                l.push(id);
            }
        }
    }

    eprintln!(
        "build: {} keys, {} contexts; writing",
        keys.len(),
        contexts.len()
    );
    let mut keys: Vec<(Vec<u8>, Vec<u32>)> = keys.into_iter().collect();
    keys.sort_unstable_by(|a, b| a.0.cmp(&b.0));
    let mut postings = BufWriter::new(File::create(out_dir.join("postings.bin"))?);
    let mut fst = fst::MapBuilder::new(BufWriter::new(File::create(out_dir.join("terms.fst"))?))?;
    let mut off = 0u64;
    let mut buf = Vec::new();
    for (key, ids) in keys {
        buf.clear();
        write_varint(&mut buf, ids.len() as u64);
        let mut prev = 0u32;
        for id in ids {
            write_varint(&mut buf, u64::from(id - prev));
            prev = id;
        }
        postings.write_all(&buf)?;
        fst.insert(&key, off)?;
        off += buf.len() as u64;
    }
    fst.finish()?;
    postings.flush()?;
    std::fs::write(out_dir.join("docs.bin"), &docs)?;
    std::fs::write(out_dir.join("payload.bin"), &payload)?;
    std::fs::write(out_dir.join("contexts.bin"), &ctx_bytes)?;
    let meta = Meta {
        docs: records.len() as u32,
        kinds,
        countries,
    };
    std::fs::write(out_dir.join("meta.json"), serde_json::to_vec(&meta)?)?;
    eprintln!("build: done");
    Ok(())
}

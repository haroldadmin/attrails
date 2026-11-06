//! Read side: memory-maps an index built by [`crate::build`] and answers
//! search-as-you-type queries.
//!
//! A query runs in three steps:
//!
//! 1. **Candidates.** Each query token is tried as the "driver". A complete
//!    token reads its posting list; the last token (still being typed) is a
//!    prefix, served from the prefix cache for 1..=3 characters or by
//!    expanding the FST. Only the first few hundred ids of each list are
//!    read, which are the most important places. The same is done in the
//!    user's grid cell and its neighbours so nearby places are found too.
//! 2. **Verification.** Every candidate must match all query tokens, either
//!    in one of its names or in its "City, State, Country" context.
//! 3. **Ranking.** Text match quality + importance + distance to the user.

use std::collections::{BinaryHeap, HashSet};
use std::fs::File;
use std::path::Path;

use anyhow::{Context, Result};
use fst::{IntoStreamer, Streamer, automaton::Automaton, automaton::Str};
use memmap2::Mmap;
use serde::Serialize;

use crate::build::{DOC_SIZE, Meta, PREFIX_CACHE_CHARS, cell};
use crate::normalize::tokens;

/// How many ids to read from each global posting list.
const GLOBAL_CANDIDATES: usize = 400;
/// How many ids to read from each local (per grid cell) posting list.
const LOCAL_CANDIDATES: usize = 100;
/// Stop expanding a prefix after this many terms.
const MAX_EXPANSIONS: usize = 4000;
/// Distance at which the location bias has decayed to ~37%.
const FOCUS_SCALE_KM: f64 = 75.0;

pub struct Index {
    fst: fst::Map<Mmap>,
    postings: Mmap,
    docs: Mmap,
    payload: Mmap,
    contexts: Mmap,
    pub meta: Meta,
}

#[derive(Serialize, Debug, Clone)]
pub struct Hit {
    pub name: String,
    pub context: String,
    pub kind: String,
    pub lat: f32,
    pub lon: f32,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub bbox: Option<[f32; 4]>,
    pub osm: String,
    pub score: f32,
    #[serde(skip)]
    pub doc: u32,
}

/// A place as stored in `docs.bin`.
#[derive(Clone, Copy)]
struct Doc {
    lat: f32,
    lon: f32,
    payload: u32,
    context: u32,
    kind: u16,
    importance: f32,
}

struct Payload<'a> {
    bbox: Option<[f32; 4]>,
    name: &'a str,
    osm: &'a str,
    names: Vec<&'a str>,
}

fn read_varint(buf: &[u8], pos: &mut usize) -> u64 {
    let mut v = 0u64;
    let mut shift = 0;
    loop {
        let b = buf[*pos];
        *pos += 1;
        v |= u64::from(b & 0x7f) << shift;
        if b < 0x80 {
            return v;
        }
        shift += 7;
    }
}

#[allow(clippy::cast_possible_truncation)]
fn read_str<'a>(buf: &'a [u8], pos: &mut usize) -> &'a str {
    let len = read_varint(buf, pos) as usize;
    let s = std::str::from_utf8(&buf[*pos..*pos + len]).unwrap_or("");
    *pos += len;
    s
}

fn f32_at(b: &[u8], at: usize) -> f32 {
    f32::from_le_bytes(b[at..at + 4].try_into().expect("4 bytes"))
}

fn u32_at(b: &[u8], at: usize) -> u32 {
    u32::from_le_bytes(b[at..at + 4].try_into().expect("4 bytes"))
}

fn haversine_km(lat1: f64, lon1: f64, lat2: f64, lon2: f64) -> f64 {
    let (p1, p2) = (lat1.to_radians(), lat2.to_radians());
    let dp = p2 - p1;
    let dl = (lon2 - lon1).to_radians();
    let a = (dp / 2.0).sin().powi(2) + p1.cos() * p2.cos() * (dl / 2.0).sin().powi(2);
    2.0 * 6371.0 * a.sqrt().asin()
}

/// Small nudges so a query like "zermatt" prefers the town over a hut
/// named after it.
fn kind_boost(kind: &str) -> f32 {
    match kind {
        "place=country" | "place=state" | "place=city" | "boundary=national_park" => 0.15,
        "place=town" | "place=island" | "natural=mountain_range" => 0.10,
        "place=village" | "natural=peak" | "natural=volcano" | "mountain_pass=yes" => 0.05,
        "highway=path" | "highway=cycleway" | "highway=bridleway" | "landuse=forest" => -0.05,
        _ => 0.0,
    }
}

fn map(dir: &Path, name: &str) -> Result<Mmap> {
    let f = File::open(dir.join(name)).with_context(|| format!("opening {name}"))?;
    // SAFETY: the index is written once by `build` and never modified while
    // being served.
    Ok(unsafe { Mmap::map(&f)? })
}

pub struct Query<'a> {
    pub text: &'a str,
    /// Bias results towards this point (latitude, longitude).
    pub focus: Option<(f64, f64)>,
    pub limit: usize,
}

impl Index {
    pub fn open(dir: &Path) -> Result<Self> {
        Ok(Self {
            fst: fst::Map::new(map(dir, "terms.fst")?)?,
            postings: map(dir, "postings.bin")?,
            docs: map(dir, "docs.bin")?,
            payload: map(dir, "payload.bin")?,
            contexts: map(dir, "contexts.bin")?,
            meta: serde_json::from_slice(&std::fs::read(dir.join("meta.json"))?)?,
        })
    }

    pub fn len(&self) -> u32 {
        self.meta.docs
    }

    #[allow(dead_code)]
    pub fn is_empty(&self) -> bool {
        self.meta.docs == 0
    }

    fn doc(&self, id: u32) -> Doc {
        let at = id as usize * DOC_SIZE;
        let d = &self.docs[at..at + DOC_SIZE];
        Doc {
            lat: f32_at(d, 0),
            lon: f32_at(d, 4),
            payload: u32_at(d, 8),
            context: u32_at(d, 12),
            kind: u16::from_le_bytes([d[16], d[17]]),
            importance: f32::from(u16::from_le_bytes([d[18], d[19]])) / f32::from(u16::MAX),
        }
    }

    fn payload(&self, off: u32) -> Payload<'_> {
        let buf = &self.payload[..];
        let mut pos = off as usize;
        let has_bbox = buf[pos] == 1;
        pos += 1;
        let bbox = has_bbox.then(|| {
            let b = [0, 4, 8, 12].map(|i| f32_at(buf, pos + i));
            pos += 16;
            b
        });
        let name = read_str(buf, &mut pos);
        let osm = read_str(buf, &mut pos);
        let n = read_varint(buf, &mut pos);
        let names = (0..n).map(|_| read_str(buf, &mut pos)).collect();
        Payload {
            bbox,
            name,
            osm,
            names,
        }
    }

    /// The display label and normalised tokens of a context.
    fn context(&self, off: u32) -> (&str, &str) {
        let mut pos = off as usize;
        let label = read_str(&self.contexts, &mut pos);
        let norm = read_str(&self.contexts, &mut pos);
        (label, norm)
    }

    /// Up to `limit` ids from the posting list at `off`, stopping early once
    /// ids exceed `below` (they are sorted, and higher ids rank lower).
    #[allow(clippy::cast_possible_truncation)]
    fn read_postings(&self, off: u64, limit: usize, below: u32, out: &mut impl Extend<u32>) {
        let mut pos = off as usize;
        let n = read_varint(&self.postings, &mut pos) as usize;
        let mut id = 0u32;
        for _ in 0..n.min(limit) {
            id += read_varint(&self.postings, &mut pos) as u32;
            if id > below {
                break;
            }
            out.extend([id]);
        }
    }

    /// The `limit` best ids whose names contain a token starting with
    /// `prefix`, among keys under `space` (`T` + ..., or `G` + cell + ...).
    fn prefix_candidates(&self, space: &[u8], prefix: &str, limit: usize, out: &mut Vec<u32>) {
        if prefix.chars().count() <= PREFIX_CACHE_CHARS {
            let cache = if space[0] == b'T' {
                [&b"P"[..], prefix.as_bytes()].concat()
            } else {
                [&b"Q"[..], &space[1..], prefix.as_bytes()].concat()
            };
            if let Some(off) = self.fst.get(&cache) {
                self.read_postings(off, limit, u32::MAX, out);
            }
            return;
        }
        // Expand the prefix, keeping the `limit` smallest ids in a max-heap.
        let key = [space, prefix.as_bytes()].concat();
        let key = std::str::from_utf8(&key).unwrap_or_default();
        let mut stream = self.fst.search(Str::new(key).starts_with()).into_stream();
        let mut heap: BinaryHeap<u32> = BinaryHeap::with_capacity(limit + 1);
        let mut seen = HashSet::new();
        let mut buf = Vec::new();
        let mut expansions = 0;
        while let Some((_, off)) = stream.next() {
            expansions += 1;
            if expansions > MAX_EXPANSIONS {
                break;
            }
            let below = if heap.len() >= limit {
                *heap.peek().expect("non-empty")
            } else {
                u32::MAX
            };
            buf.clear();
            self.read_postings(off, limit, below, &mut buf);
            for &id in &buf {
                if seen.insert(id) {
                    heap.push(id);
                    if heap.len() > limit {
                        heap.pop();
                    }
                }
            }
        }
        out.extend(heap);
    }

    fn token_candidates(
        &self,
        space: &[u8],
        token: &str,
        is_prefix: bool,
        limit: usize,
        out: &mut Vec<u32>,
    ) {
        if is_prefix {
            self.prefix_candidates(space, token, limit, out);
        } else if let Some(off) = self.fst.get([space, token.as_bytes()].concat()) {
            self.read_postings(off, limit, u32::MAX, out);
        }
    }

    pub fn search(&self, q: &Query<'_>) -> Vec<Hit> {
        let mut qt = tokens(q.text);
        qt.truncate(6);
        if qt.is_empty() {
            return Vec::new();
        }
        // The last token is still being typed unless the query ends in a space.
        let last_prefix = !q.text.ends_with(char::is_whitespace);
        let is_prefix = |i: usize| last_prefix && i == qt.len() - 1;

        let mut candidates = Vec::new();
        let cells: Vec<u16> = q.focus.map_or_else(Vec::new, |(lat, lon)| {
            let mut c: Vec<u16> = [-1.9, 0.0, 1.9]
                .iter()
                .flat_map(|dy| [-1.9, 0.0, 1.9].map(|dx| cell(lat + dy, lon + dx)))
                .collect();
            c.sort_unstable();
            c.dedup();
            c
        });
        for (i, t) in qt.iter().enumerate() {
            self.token_candidates(b"T", t, is_prefix(i), GLOBAL_CANDIDATES, &mut candidates);
            for c in &cells {
                let space = [&b"G"[..], &c.to_be_bytes()].concat();
                self.token_candidates(&space, t, is_prefix(i), LOCAL_CANDIDATES, &mut candidates);
            }
        }
        candidates.sort_unstable();
        candidates.dedup();

        let mut hits: Vec<Hit> = candidates
            .into_iter()
            .filter_map(|id| self.score(id, &qt, last_prefix, q.focus))
            .collect();
        hits.sort_by(|a, b| b.score.total_cmp(&a.score).then(a.doc.cmp(&b.doc)));
        // Drop near-duplicates (same name, context and kind), keeping the best.
        let mut seen = HashSet::new();
        hits.retain(|h| seen.insert((h.name.clone(), h.context.clone(), h.kind.clone())));
        hits.truncate(q.limit);
        hits
    }

    #[allow(clippy::cast_possible_truncation, clippy::cast_precision_loss)]
    fn score(
        &self,
        id: u32,
        qt: &[String],
        last_prefix: bool,
        focus: Option<(f64, f64)>,
    ) -> Option<Hit> {
        let doc = self.doc(id);
        let p = self.payload(doc.payload);
        let (label, ctx_norm) = self.context(doc.context);
        let matches = |q: &str, i: usize, t: &str| {
            t == q || (last_prefix && i == qt.len() - 1 && t.starts_with(q))
        };

        // Best name: the one matching the most query tokens.
        let mut best: Option<(usize, f32)> = None;
        for name in &p.names {
            let nt: Vec<&str> = name.split(' ').collect();
            let mut in_name = 0;
            let mut ok = true;
            for (i, q) in qt.iter().enumerate() {
                if nt.iter().any(|t| matches(q, i, t)) {
                    in_name += 1;
                } else if !ctx_norm.split(' ').any(|t| matches(q, i, t)) {
                    ok = false;
                    break;
                }
            }
            if !ok || in_name == 0 {
                continue;
            }
            let mut text = in_name as f32 / qt.len() as f32;
            if in_name == qt.len() && in_name == nt.len() {
                text += 0.5; // The whole name was typed.
            }
            if matches(&qt[0], 0, nt[0]) {
                text += 0.2; // Typed from the start of the name.
            }
            if best.is_none_or(|(_, s)| text > s) {
                best = Some((in_name, text));
            }
        }
        let (_, text) = best?;

        let kind = &self.meta.kinds[doc.kind as usize];
        let mut score = text + doc.importance + kind_boost(kind);
        if let Some((lat, lon)) = focus {
            let d = haversine_km(lat, lon, f64::from(doc.lat), f64::from(doc.lon));
            score += 0.6 * (-d / FOCUS_SCALE_KM).exp() as f32;
        }
        Some(Hit {
            name: p.name.to_owned(),
            context: label.to_owned(),
            kind: kind.clone(),
            lat: doc.lat,
            lon: doc.lon,
            bbox: p.bbox,
            osm: p.osm.to_owned(),
            score,
            doc: id,
        })
    }

    /// The display name of a doc (used to generate benchmark queries).
    pub fn name_of(&self, id: u32) -> (String, f32, f32) {
        let d = self.doc(id);
        (self.payload(d.payload).name.to_owned(), d.lat, d.lon)
    }
}

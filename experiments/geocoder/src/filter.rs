//! Stage 1: stream a Photon JSON dump (`*.jsonl.zst`) and keep only the
//! places ATTrails users are likely to search for.
//!
//! The planet dump is ~27 GB compressed and ~550 GB uncompressed (it carries
//! full geometries), so this never holds the dump in memory: a reader thread
//! decompresses lines in batches and rayon filters each batch in parallel.
//! Lines are rejected from their `osm_key`/`osm_value` before any JSON
//! parsing, which is what keeps this fast.

use std::collections::{BTreeMap, HashMap};
use std::io::{BufRead, BufReader, Read, Write};
use std::sync::mpsc::sync_channel;

use anyhow::Result;
use memchr::memmem;
use rayon::prelude::*;
use serde::{Deserialize, Serialize};
use serde_json::Value;

/// One output line.
#[derive(Serialize, Deserialize)]
#[serde(tag = "t")]
pub enum Item {
    /// English country names, keyed by lowercase ISO code.
    Countries {
        names: BTreeMap<String, String>,
    },
    Place(Record),
}

/// A searchable place, stripped down to what the index needs.
#[derive(Serialize, Deserialize, Clone)]
pub struct Record {
    /// OSM type and id, e.g. `N256042820`.
    pub osm: String,
    /// `osm_key=osm_value`, e.g. `natural=peak`.
    pub kind: String,
    /// Display name (the local `name` tag).
    pub name: String,
    /// Every name a user might type: local, English and other common
    /// languages, `alt_name`, `short_name`, ...
    pub names: Vec<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub city: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub county: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub state: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub cc: Option<String>,
    /// Local names of the city, county and state when the fields above hold
    /// the English ones, so "Innsbruck Tirol" matches as well as "... Tyrol".
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub context_alt: Vec<String>,
    pub importance: f32,
    pub lon: f64,
    pub lat: f64,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub bbox: Option<[f32; 4]>,
}

/// The allowlist. Everything else (houses, streets, shops, bus stops, ...)
/// is dropped. These are the things people start or end a ride, run or hike
/// at, or browse routes around.
pub fn keep(key: &str, value: &str) -> bool {
    match key {
        "place" => matches!(
            value,
            "country"
                | "state"
                | "region"
                | "province"
                | "county"
                | "municipality"
                | "city"
                | "town"
                | "village"
                | "hamlet"
                | "suburb"
                | "quarter"
                | "borough"
                | "city_district"
                | "neighbourhood"
                | "locality"
                | "island"
                | "islet"
                | "archipelago"
        ),
        "boundary" => matches!(value, "administrative" | "national_park" | "protected_area"),
        "natural" => matches!(
            value,
            "peak"
                | "volcano"
                | "saddle"
                | "ridge"
                | "arete"
                | "valley"
                | "gorge"
                | "glacier"
                | "water"
                | "bay"
                | "beach"
                | "cape"
                | "peninsula"
                | "strait"
                | "spring"
                | "cave_entrance"
                | "waterfall"
                | "wood"
                | "heath"
                | "fell"
                | "plateau"
                | "hill"
                | "mountain_range"
                | "dune"
        ),
        "water" => matches!(value, "lake" | "reservoir" | "river" | "lagoon"),
        "waterway" => matches!(value, "river" | "waterfall" | "canal"),
        "mountain_pass" => value == "yes",
        "tourism" => matches!(
            value,
            "alpine_hut"
                | "wilderness_hut"
                | "viewpoint"
                | "camp_site"
                | "attraction"
                | "picnic_site"
        ),
        "leisure" => matches!(value, "park" | "nature_reserve"),
        "landuse" => value == "forest",
        "highway" => matches!(value, "trailhead" | "path" | "cycleway" | "bridleway"),
        "railway" => matches!(value, "station" | "halt"),
        "aerialway" => value == "station",
        "historic" => matches!(value, "castle" | "monument" | "archaeological_site"),
        _ => false,
    }
}

/// Languages whose `name:*` tags are indexed besides `name`.
const NAME_LANGS: &[&str] = &["en", "de", "fr", "es", "it", "pt", "nl"];
/// Other name tags worth matching on.
const NAME_TAGS: &[&str] = &["int_name", "short_name", "official_name", "alt_name"];

/// `content` stays raw: parsing it into a `Value` would materialise huge
/// geometries (country borders are hundreds of MB) as JSON trees.
#[derive(Deserialize)]
struct RawLine<'a> {
    #[serde(rename = "type")]
    ty: &'a str,
    #[serde(borrow)]
    content: &'a serde_json::value::RawValue,
}

#[derive(Deserialize)]
struct RawPlace {
    object_type: String,
    object_id: u64,
    osm_key: String,
    osm_value: String,
    #[serde(default)]
    importance: Option<f64>,
    #[serde(default)]
    name: HashMap<String, String>,
    #[serde(default)]
    address: HashMap<String, Value>,
    #[serde(default)]
    country_code: Option<String>,
    centroid: [f64; 2],
    #[serde(default)]
    bbox: Option<[f64; 4]>,
}

/// Cheap check on the raw line: does any `osm_key`/`osm_value` pair pass
/// the allowlist? Avoids parsing ~95% of lines.
fn prefilter(line: &[u8]) -> bool {
    let key_pat = memmem::Finder::new(b"\"osm_key\":\"");
    let val_pat = memmem::Finder::new(b"\"osm_value\":\"");
    let mut rest = line;
    while let Some(i) = key_pat.find(rest) {
        rest = &rest[i + key_pat.needle().len()..];
        let Some(kend) = memchr::memchr(b'"', rest) else {
            return false;
        };
        let key = &rest[..kend];
        let Some(j) = val_pat.find(rest) else {
            return false;
        };
        let vrest = &rest[j + val_pat.needle().len()..];
        let Some(vend) = memchr::memchr(b'"', vrest) else {
            return false;
        };
        let value = &vrest[..vend];
        if let (Ok(k), Ok(v)) = (std::str::from_utf8(key), std::str::from_utf8(value))
            && keep(k, v)
        {
            return true;
        }
        rest = vrest;
    }
    false
}

fn addr_value(v: &Value) -> Option<String> {
    match v {
        Value::String(s) => Some(s.clone()),
        Value::Array(a) => a.first().and_then(Value::as_str).map(str::to_owned),
        _ => None,
    }
}

/// The English value of an address part if there is one, else the local one.
fn addr_str(address: &HashMap<String, Value>, key: &str) -> Option<String> {
    address
        .get(&format!("{key}:en"))
        .or_else(|| address.get(key))
        .and_then(addr_value)
}

/// Local values of address parts that differ from the English ones.
fn addr_alt(address: &HashMap<String, Value>) -> Vec<String> {
    ["city", "county", "state"]
        .iter()
        .filter_map(|k| {
            let local = address.get(*k).and_then(addr_value)?;
            let en = address.get(&format!("{k}:en")).and_then(addr_value)?;
            (local != en).then_some(local)
        })
        .collect()
}

fn to_record(p: RawPlace) -> Option<Record> {
    if !keep(&p.osm_key, &p.osm_value) {
        return None;
    }
    let name = p
        .name
        .get("name")
        .or_else(|| p.name.get("name:en"))
        .or_else(|| p.name.values().next())?
        .clone();
    let mut names = vec![name.clone()];
    let mut push = |s: &str| {
        for part in s.split(';') {
            let part = part.trim();
            if !part.is_empty() && !names.iter().any(|n| n == part) {
                names.push(part.to_owned());
            }
        }
    };
    for lang in NAME_LANGS {
        if let Some(n) = p.name.get(&format!("name:{lang}")) {
            push(n);
        }
    }
    for tag in NAME_TAGS {
        if let Some(n) = p.name.get(*tag) {
            push(n);
        }
    }
    let [lon, lat] = p.centroid;
    #[allow(clippy::cast_possible_truncation)]
    let bbox = p
        .bbox
        .filter(|b| b[0] != b[2] || b[1] != b[3])
        // Photon writes [min lon, max lat, max lon, min lat]; store
        // [min lon, min lat, max lon, max lat].
        .map(|[a, b, c, d]| [a.min(c), b.min(d), a.max(c), b.max(d)].map(|x| x as f32));
    #[allow(clippy::cast_possible_truncation)]
    Some(Record {
        osm: format!("{}{}", p.object_type, p.object_id),
        kind: format!("{}={}", p.osm_key, p.osm_value),
        name,
        names,
        city: addr_str(&p.address, "city"),
        county: addr_str(&p.address, "county"),
        state: addr_str(&p.address, "state"),
        cc: p.country_code,
        context_alt: addr_alt(&p.address),
        importance: p.importance.unwrap_or(0.0) as f32,
        lon,
        lat,
        bbox,
    })
}

fn countries(content: &Value) -> BTreeMap<String, String> {
    let mut out = BTreeMap::new();
    for c in content.as_array().into_iter().flatten() {
        let (Some(cc), Some(names)) = (c["country_code"].as_str(), c["name"].as_object()) else {
            continue;
        };
        let name = names
            .get("name:en")
            .or_else(|| names.get("name"))
            .and_then(Value::as_str);
        if let Some(name) = name {
            out.insert(cc.to_owned(), name.to_owned());
        }
    }
    out
}

fn process(line: &[u8]) -> Vec<Item> {
    let trimmed = line.trim_ascii_start();
    let is_country_info = trimmed.starts_with(b"{\"type\":\"CountryInfo\"");
    if !is_country_info && !prefilter(line) {
        return Vec::new();
    }
    let Ok(raw) = serde_json::from_slice::<RawLine>(line) else {
        return Vec::new();
    };
    match raw.ty {
        "CountryInfo" => {
            let content: Value = serde_json::from_str(raw.content.get()).unwrap_or_default();
            vec![Item::Countries {
                names: countries(&content),
            }]
        }
        "Place" => {
            // Unknown fields (including `geometry`) are skipped without allocating.
            let places: Vec<RawPlace> = serde_json::from_str(raw.content.get()).unwrap_or_default();
            places
                .into_iter()
                .filter_map(to_record)
                .map(Item::Place)
                .collect()
        }
        _ => Vec::new(),
    }
}

/// Where kept places go: zstd JSON lines, or Parquet when the output path
/// ends in `.parquet`.
enum Sink {
    Jsonl(zstd::stream::AutoFinishEncoder<'static, Box<dyn Write>>),
    Parquet(crate::parquet_io::Writer),
}

impl Sink {
    fn open(path: &str) -> Result<Self> {
        if path.ends_with(".parquet") {
            return Ok(Self::Parquet(crate::parquet_io::Writer::create(
                std::path::Path::new(path),
            )?));
        }
        let out: Box<dyn Write> = match path {
            "-" => Box::new(std::io::stdout()),
            path => Box::new(std::fs::File::create(path)?),
        };
        Ok(Self::Jsonl(zstd::Encoder::new(out, 6)?.auto_finish()))
    }

    fn push(&mut self, item: Item) -> Result<()> {
        match self {
            Self::Jsonl(out) => {
                serde_json::to_writer(&mut *out, &item)?;
                out.write_all(b"\n")?;
            }
            Self::Parquet(w) => w.push(item)?,
        }
        Ok(())
    }

    fn finish(self) -> Result<()> {
        match self {
            Self::Jsonl(out) => drop(out),
            Self::Parquet(w) => w.finish()?,
        }
        Ok(())
    }
}

/// Reads a (zstd-compressed) Photon dump from `input` and writes kept
/// places to `output` (see [`Sink`]).
pub fn run(input: impl Read + Send + 'static, output: &str) -> Result<()> {
    const BATCH: usize = 20_000;
    let (tx, rx) = sync_channel::<Vec<Vec<u8>>>(8);
    let reader = std::thread::spawn(move || -> Result<()> {
        let mut r = BufReader::with_capacity(1 << 20, zstd::Decoder::new(input)?);
        loop {
            let mut batch = Vec::with_capacity(BATCH);
            for _ in 0..BATCH {
                let mut buf = Vec::new();
                if r.read_until(b'\n', &mut buf)? == 0 {
                    break;
                }
                batch.push(buf);
            }
            let done = batch.len() < BATCH;
            if tx.send(batch).is_err() || done {
                return Ok(());
            }
        }
    });

    let mut out = Sink::open(output)?;
    let (mut lines, mut kept) = (0u64, 0u64);
    let mut by_kind: BTreeMap<String, u64> = BTreeMap::new();
    for batch in rx {
        lines += batch.len() as u64;
        let items: Vec<Item> = batch.par_iter().flat_map_iter(|l| process(l)).collect();
        for item in items {
            if let Item::Place(r) = &item {
                kept += 1;
                *by_kind.entry(r.kind.clone()).or_default() += 1;
            }
            out.push(item)?;
        }
        if lines % 5_000_000 < BATCH as u64 {
            eprintln!("filter: {lines} lines read, {kept} places kept");
        }
    }
    reader.join().expect("reader thread panicked")?;
    out.finish()?;
    eprintln!("filter: done. {lines} lines read, {kept} places kept");
    let mut kinds: Vec<_> = by_kind.into_iter().collect();
    kinds.sort_by_key(|(_, n)| std::cmp::Reverse(*n));
    for (k, n) in kinds {
        eprintln!("  {n:>10}  {k}");
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn prefilter_reads_key_and_value() {
        let peak =
            br#"{"type":"Place","content":[{"osm_key":"natural","osm_value":"peak","name":{}}]}"#;
        let house = br#"{"type":"Place","content":[{"osm_key":"building","osm_value":"house"}]}"#;
        assert!(prefilter(peak));
        assert!(!prefilter(house));
    }
}

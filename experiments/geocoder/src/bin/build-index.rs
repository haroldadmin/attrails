//! Builds the index file from the extractor's output.
//!
//! usage: build-index <extract.jsonl> <countries.json> <out.idx> [--no-kind key=value]...

use std::collections::HashMap;
use std::io::{BufRead, BufReader};
use std::path::Path;

use anyhow::Context;
use geocoder::index::{
    NS_CONTEXT, NS_PREFIX, NS_TERM, PREFIX_CHARS, SHORT_PREFIX_CAP, Writer, as_bytes,
};
use geocoder::normalize::tokens;
use serde::Deserialize;
use serde_json::Value;

#[derive(Deserialize)]
struct Place {
    object_type: String,
    object_id: i64,
    osm_key: String,
    osm_value: String,
    importance: f64,
    name: HashMap<String, String>,
    #[serde(default)]
    address: HashMap<String, Value>,
    country_code: String,
    centroid: [f64; 2],
    bbox: Option<[f64; 4]>,
}

#[derive(Deserialize)]
struct Country {
    country_code: String,
    name: HashMap<String, String>,
}

struct Doc {
    importance: f32,
    lat: i32,
    lon: i32,
    kind: u8,
    country: [u8; 2],
    context: u32,
    osm: u64,
    bbox: [f32; 4],
    display: Box<str>,
    terms: Box<[u32]>,
}

#[derive(Default)]
struct Interner {
    ids: HashMap<String, u32>,
    names: Vec<String>,
}

impl Interner {
    fn id(&mut self, s: &str) -> u32 {
        if let Some(&id) = self.ids.get(s) {
            return id;
        }
        let id = self.names.len() as u32;
        self.ids.insert(s.to_string(), id);
        self.names.push(s.to_string());
        id
    }
}

fn addr<'a>(address: &'a HashMap<String, Value>, key: &str) -> Option<&'a str> {
    address.get(key).and_then(Value::as_str)
}

fn main() -> anyhow::Result<()> {
    let args: Vec<String> = std::env::args().collect();
    let (input, countries_path, output) = (&args[1], &args[2], &args[3]);
    let skip: Vec<&str> = args[4..]
        .chunks(2)
        .filter(|c| c[0] == "--no-kind")
        .map(|c| c[1].as_str())
        .collect();
    let started = std::time::Instant::now();

    let countries: Vec<Country> = serde_json::from_reader(std::fs::File::open(countries_path)?)?;
    let countries: HashMap<String, Country> = countries
        .into_iter()
        .map(|c| (c.country_code.clone(), c))
        .collect();

    let mut terms = Interner::default();
    let mut kinds = Interner::default();
    let mut contexts = Interner::default();
    let mut ctx_labels: Vec<String> = Vec::new();
    let mut ctx_terms: HashMap<String, Vec<u32>> = HashMap::new();
    let mut docs: Vec<Doc> = Vec::new();

    let reader = BufReader::with_capacity(1 << 22, std::fs::File::open(input)?);
    for line in reader.lines() {
        let line = line?;
        let p: Place = serde_json::from_str(&line).with_context(|| line.clone())?;
        let kind = format!("{}={}", p.osm_key, p.osm_value);
        if skip.contains(&kind.as_str()) {
            continue;
        }
        // Rivers are mapped as many short ways; only the relation that ties
        // them together is one searchable thing.
        if kind == "waterway=river" && p.object_type != "R" {
            continue;
        }
        let Some(local) = p.name.get("name").or_else(|| p.name.values().next()) else {
            continue;
        };

        let mut doc_terms: Vec<u32> = Vec::new();
        for (key, name) in &p.name {
            if key.starts_with("old_name") {
                continue;
            }
            for token in tokens(name) {
                doc_terms.push(terms.id(&token));
            }
        }
        doc_terms.sort_unstable();
        doc_terms.dedup();
        if doc_terms.is_empty() {
            continue;
        }

        // Context: the enclosing city, county and state plus the country.
        let parts: Vec<&str> = ["city", "county", "state"]
            .iter()
            .filter_map(|k| addr(&p.address, k))
            .filter(|v| *v != local.as_str())
            .collect();
        let ctx_key = format!("{}|{}", p.country_code, parts.join("|"));
        let context = if let Some(&id) = contexts.ids.get(&ctx_key) {
            id
        } else {
            let id = contexts.id(&ctx_key);
            let country = countries.get(&p.country_code);
            let country_name = country
                .and_then(|c| c.name.get("name:en").or_else(|| c.name.get("name")))
                .map_or("", String::as_str);
            let mut label = parts.clone();
            if !country_name.is_empty() {
                label.push(country_name);
            }
            ctx_labels.push(label.join(", "));

            let mut words: Vec<String> = Vec::new();
            for (key, value) in &p.address {
                let base = key.split(':').next().unwrap_or("");
                if matches!(base, "city" | "county" | "state") {
                    if let Some(v) = value.as_str() {
                        words.extend(tokens(v));
                    }
                }
            }
            // ISO 3166-2 codes such as "US-IL" make "springfield il" work.
            let others = match p.address.get("other") {
                Some(Value::String(s)) => vec![s.as_str()],
                Some(Value::Array(a)) => a.iter().filter_map(Value::as_str).collect(),
                _ => vec![],
            };
            for other in others {
                if let Some((cc, sub)) = other.split_once('-') {
                    if cc.len() == 2 && sub.len() <= 3 && cc.eq_ignore_ascii_case(&p.country_code) {
                        words.extend(tokens(sub));
                    }
                }
            }
            words.extend(tokens(&p.country_code));
            match p.country_code.as_str() {
                "gb" => words.push("uk".into()),
                "us" => words.push("usa".into()),
                _ => {}
            }
            if let Some(c) = country {
                for name in c.name.values() {
                    words.extend(tokens(name));
                }
            }
            words.sort_unstable();
            words.dedup();
            for w in words {
                ctx_terms.entry(w).or_default().push(id);
            }
            id
        };

        let display = match p.name.get("name:en") {
            Some(en) if en != local => format!("{local}\x1f{en}"),
            _ => local.clone(),
        };
        let [lon, lat] = p.centroid;
        let bbox = p.bbox.unwrap_or([lon, lat, lon, lat]);
        let cc = p.country_code.as_bytes();
        docs.push(Doc {
            importance: p.importance as f32,
            lat: (lat * 1e7) as i32,
            lon: (lon * 1e7) as i32,
            kind: u8::try_from(kinds.id(&kind)).context("too many kinds")?,
            country: if cc.len() == 2 {
                [cc[0], cc[1]]
            } else {
                [b'?', b'?']
            },
            context,
            osm: (u64::from(p.object_type.as_bytes()[0]) << 56) | (p.object_id as u64),
            bbox: bbox.map(|v| v as f32),
            display: display.into(),
            terms: doc_terms.into(),
        });
        if docs.len() % 2_000_000 == 0 {
            eprintln!(
                "read {} docs, {} terms, {:?}",
                docs.len(),
                terms.names.len(),
                started.elapsed()
            );
        }
    }
    eprintln!(
        "read {} docs, {} terms, {} contexts",
        docs.len(),
        terms.names.len(),
        contexts.names.len()
    );

    // Best first, so every posting list is in ranking order.
    docs.sort_by(|a, b| {
        b.importance
            .total_cmp(&a.importance)
            .then(a.osm.cmp(&b.osm))
    });

    let mut w = Writer::create(Path::new(output))?;
    w.meta().docs = docs.len() as u32;
    w.meta().contexts = ctx_labels.len() as u32;
    w.meta().kinds = kinds.names.clone();
    w.meta().built_from = input.clone();

    macro_rules! column {
        ($name:literal, $f:expr) => {{
            let col: Vec<_> = docs.iter().map($f).collect();
            w.section($name, as_bytes(&col))?;
        }};
    }
    column!("lat", |d| d.lat);
    column!("lon", |d| d.lon);
    column!("importance", |d| (d.importance.clamp(0.0, 1.0) * 65535.0)
        as u16);
    column!("kind", |d| d.kind);
    column!("country", |d| d.country);
    column!("context", |d| d.context);
    column!("osm", |d| d.osm);
    column!("bbox", |d| d.bbox);

    let mut off = vec![0u64];
    w.begin("names")?;
    for d in &docs {
        w.append(d.display.as_bytes())?;
        off.push(off.last().unwrap() + d.display.len() as u64);
    }
    w.end("names");
    w.section("name_off", as_bytes(&off))?;

    let mut off = vec![0u64];
    w.begin("ctx_names")?;
    for label in &ctx_labels {
        w.append(label.as_bytes())?;
        off.push(off.last().unwrap() + label.len() as u64);
    }
    w.end("ctx_names");
    w.section("ctx_off", as_bytes(&off))?;

    // Term postings in CSR form; filling in doc order keeps each list sorted.
    let n_terms = terms.names.len();
    let mut start = vec![0u64; n_terms + 1];
    for d in &docs {
        for &t in &d.terms {
            start[t as usize + 1] += 1;
        }
    }
    for i in 0..n_terms {
        start[i + 1] += start[i];
    }
    let mut flat = vec![0u32; start[n_terms] as usize];
    let mut cursor = start.clone();
    for (doc, d) in docs.iter().enumerate() {
        for &t in &d.terms {
            flat[cursor[t as usize] as usize] = doc as u32;
            cursor[t as usize] += 1;
        }
    }
    drop(cursor);
    drop(docs);
    eprintln!("{} term postings, {:?}", flat.len(), started.elapsed());
    let list = |t: u32| &flat[start[t as usize] as usize..start[t as usize + 1] as usize];

    let mut order: Vec<u32> = (0..n_terms as u32).collect();
    order.sort_unstable_by(|&a, &b| terms.names[a as usize].cmp(&terms.names[b as usize]));

    let mut keys: Vec<(Vec<u8>, u64)> = Vec::with_capacity(n_terms * 2);
    let mut post_off: Vec<u64> = vec![0];
    w.begin("post")?;
    let key = |ns: u8, s: &str| {
        let mut k = Vec::with_capacity(s.len() + 1);
        k.push(ns);
        k.extend_from_slice(s.as_bytes());
        k
    };
    for &t in &order {
        let l = list(t);
        keys.push((
            key(NS_TERM, &terms.names[t as usize]),
            post_off.len() as u64 - 1,
        ));
        w.append(as_bytes(l))?;
        post_off.push(post_off.last().unwrap() + l.len() as u64);
    }

    // Prefix postings: terms sharing a prefix are adjacent in sorted order.
    let char_prefix = |s: &str, n: usize| -> Option<usize> {
        let mut it = s.char_indices();
        match it.nth(n - 1) {
            Some((i, c)) => Some(i + c.len_utf8()),
            None => None,
        }
    };
    let mut prefix_postings = 0u64;
    for len in 1..=PREFIX_CHARS {
        let mut i = 0;
        while i < order.len() {
            let name = &terms.names[order[i] as usize];
            let Some(end) = char_prefix(name, len) else {
                i += 1;
                continue;
            };
            let prefix = &name[..end];
            let mut j = i + 1;
            while j < order.len() && terms.names[order[j] as usize].starts_with(prefix) {
                j += 1;
            }
            if j - i == 1 {
                // Only one term has this prefix: share its list.
                let id = keys[i].1;
                keys.push((key(NS_PREFIX, prefix), id));
            } else {
                let mut merged: Vec<u32> = Vec::new();
                for &t in &order[i..j] {
                    merged.extend_from_slice(list(t));
                }
                merged.sort_unstable();
                merged.dedup();
                if len <= 2 {
                    merged.truncate(SHORT_PREFIX_CAP);
                }
                keys.push((key(NS_PREFIX, prefix), post_off.len() as u64 - 1));
                w.append(as_bytes(&merged))?;
                prefix_postings += merged.len() as u64;
                post_off.push(post_off.last().unwrap() + merged.len() as u64);
            }
            i = j;
        }
        eprintln!(
            "prefix length {len} done, {prefix_postings} prefix postings, {:?}",
            started.elapsed()
        );
    }

    for (term, ids) in &ctx_terms {
        keys.push((key(NS_CONTEXT, term), post_off.len() as u64 - 1));
        w.append(as_bytes(ids))?;
        post_off.push(post_off.last().unwrap() + ids.len() as u64);
    }
    w.end("post");
    w.section("post_off", as_bytes(&post_off))?;

    keys.sort_unstable();
    let mut fst = fst::MapBuilder::memory();
    for (k, v) in &keys {
        fst.insert(k, *v)?;
    }
    let fst = fst.into_inner()?;
    eprintln!("fst: {} keys, {} bytes", keys.len(), fst.len());
    w.section("fst", &fst)?;
    let size = w.finish()?;
    eprintln!(
        "wrote {output}: {:.1} MB in {:?}",
        size as f64 / 1e6,
        started.elapsed()
    );
    Ok(())
}

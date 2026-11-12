//! Streams a Photon JSON dump (`.jsonl.zst` on stdin) and keeps only the
//! places people are likely to search for in an outdoor-routes app. Writes
//! compact JSON lines to stdout and a histogram of every `osm_key=osm_value`
//! seen to the path in argv[1].

use std::collections::HashMap;
use std::io::{BufRead, BufReader, BufWriter, Write};

use geocoder::filter::keep;
use memchr::memmem;
use serde::{Deserialize, Serialize};
use serde_json::Value;

#[derive(Deserialize)]
struct Line {
    content: Vec<Place>,
}

#[derive(Deserialize, Serialize)]
struct Place {
    object_type: String,
    object_id: i64,
    osm_key: String,
    osm_value: String,
    #[serde(default)]
    address_type: String,
    #[serde(default)]
    importance: f64,
    #[serde(default)]
    name: HashMap<String, String>,
    #[serde(default, skip_serializing_if = "HashMap::is_empty")]
    address: HashMap<String, Value>,
    #[serde(default, skip_serializing_if = "HashMap::is_empty")]
    extra: HashMap<String, Value>,
    #[serde(default)]
    country_code: String,
    centroid: [f64; 2],
    #[serde(default, skip_serializing_if = "Option::is_none")]
    bbox: Option<[f64; 4]>,
}

const EXTRA_KEEP: &[&str] = &[
    "ele",
    "population",
    "wikidata",
    "admin_level",
    "prominence",
    "capital",
];

fn field<'a>(line: &'a [u8], finder: &memmem::Finder) -> &'a [u8] {
    let Some(at) = finder.find(line) else {
        return b"";
    };
    let rest = &line[at + finder.needle().len()..];
    let end = memchr::memchr(b'"', rest).unwrap_or(0);
    &rest[..end]
}

fn main() -> anyhow::Result<()> {
    let hist_path = std::env::args()
        .nth(1)
        .expect("usage: extract <histogram.tsv>");
    let (line_tx, line_rx) = crossbeam_channel::bounded::<Vec<Vec<u8>>>(64);
    let (out_tx, out_rx) = crossbeam_channel::bounded::<(Vec<u8>, HashMap<String, u64>)>(64);

    let workers: Vec<_> = (0..3)
        .map(|_| {
            let rx = line_rx.clone();
            let tx = out_tx.clone();
            std::thread::spawn(move || {
                let key_f = memmem::Finder::new(b"\"osm_key\":\"");
                let val_f = memmem::Finder::new(b"\"osm_value\":\"");
                for batch in rx {
                    let mut out = Vec::new();
                    let mut hist: HashMap<String, u64> = HashMap::new();
                    for line in batch {
                        let k = std::str::from_utf8(field(&line, &key_f)).unwrap_or("");
                        let v = std::str::from_utf8(field(&line, &val_f)).unwrap_or("");
                        if k.is_empty() {
                            continue;
                        }
                        *hist.entry(format!("{k}={v}")).or_default() += 1;
                        if !keep(k, v) {
                            continue;
                        }
                        let Ok(parsed) = serde_json::from_slice::<Line>(&line) else {
                            *hist.entry("!parse_error".into()).or_default() += 1;
                            continue;
                        };
                        for mut p in parsed.content {
                            if p.name.is_empty() || !keep(&p.osm_key, &p.osm_value) {
                                continue;
                            }
                            p.extra.retain(|k, _| EXTRA_KEEP.contains(&k.as_str()));
                            serde_json::to_writer(&mut out, &p).unwrap();
                            out.push(b'\n');
                            *hist
                                .entry(format!("+{}={}", p.osm_key, p.osm_value))
                                .or_default() += 1;
                        }
                    }
                    tx.send((out, hist)).unwrap();
                }
            })
        })
        .collect();
    drop(out_tx);
    drop(line_rx);

    let writer = std::thread::spawn(move || {
        let mut w = BufWriter::new(std::io::stdout().lock());
        let mut total: HashMap<String, u64> = HashMap::new();
        for (buf, hist) in out_rx {
            w.write_all(&buf).unwrap();
            for (k, v) in hist {
                *total.entry(k).or_default() += v;
            }
        }
        w.flush().unwrap();
        let mut rows: Vec<_> = total.into_iter().collect();
        rows.sort_by(|a, b| b.1.cmp(&a.1));
        let mut f = BufWriter::new(std::fs::File::create(hist_path).unwrap());
        for (k, v) in rows {
            writeln!(f, "{v}\t{k}").unwrap();
        }
    });

    let stdin = std::io::stdin().lock();
    let mut reader = BufReader::with_capacity(1 << 22, zstd::Decoder::new(stdin)?);
    let mut batch = Vec::with_capacity(2000);
    let mut bytes = 0u64;
    let mut lines = 0u64;
    loop {
        let mut line = Vec::with_capacity(2048);
        let n = reader.read_until(b'\n', &mut line)?;
        if n == 0 {
            break;
        }
        bytes += n as u64;
        lines += 1;
        if lines % 5_000_000 == 0 {
            eprintln!("{lines} lines, {:.1} GB decompressed", bytes as f64 / 1e9);
        }
        batch.push(line);
        if batch.len() == 2000 {
            line_tx.send(std::mem::replace(&mut batch, Vec::with_capacity(2000)))?;
        }
    }
    line_tx.send(batch)?;
    drop(line_tx);
    for w in workers {
        w.join().unwrap();
    }
    writer.join().unwrap();
    eprintln!(
        "done: {lines} lines, {:.1} GB decompressed",
        bytes as f64 / 1e9
    );
    Ok(())
}

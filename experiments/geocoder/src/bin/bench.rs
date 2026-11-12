//! Latency benchmark with a synthetic typeahead workload.
//!
//! bench <index> gen <n> <seed>            write queries (TSV) to stdout
//! bench <index> run <queries.tsv>         time them in-process
//! bench <index> http <queries.tsv> <host:port> <threads>
//!
//! Queries are built from indexed names, so every one has a right answer:
//! the document it was made from. `run` reports how often that document (or
//! one with the same name) comes back.

use std::io::{BufRead, BufReader, Read, Write};
use std::path::Path;
use std::time::{Duration, Instant};

use geocoder::index::Index;
use geocoder::normalize::folded;
use geocoder::search::{Query, search};

struct Rng(u64);
impl Rng {
    fn next(&mut self) -> u64 {
        self.0 ^= self.0 << 13;
        self.0 ^= self.0 >> 7;
        self.0 ^= self.0 << 17;
        self.0
    }
    fn below(&mut self, n: u64) -> u64 {
        self.next() % n
    }
    fn unit(&mut self) -> f64 {
        (self.next() >> 11) as f64 / (1u64 << 53) as f64
    }
}

fn percentile(sorted: &[Duration], p: f64) -> Duration {
    sorted[((sorted.len() as f64 * p) as usize).min(sorted.len() - 1)]
}

fn report(label: &str, times: &mut [Duration]) {
    if times.is_empty() {
        return;
    }
    times.sort_unstable();
    println!(
        "{label:<22} n={:<6} p50={:>9.3?} p95={:>9.3?} p99={:>9.3?} max={:>9.3?}",
        times.len(),
        percentile(times, 0.50),
        percentile(times, 0.95),
        percentile(times, 0.99),
        times[times.len() - 1],
    );
}

fn main() -> anyhow::Result<()> {
    let args: Vec<String> = std::env::args().collect();
    let index = Index::open(Path::new(&args[1]))?;
    match args[2].as_str() {
        "gen" => generate(&index, args[3].parse()?, args[4].parse()?),
        "run" => run(&index, &args[3]),
        "dump" => {
            // Folded names as TSV, for loading into another engine to compare.
            let mut out = std::io::BufWriter::new(std::io::stdout().lock());
            for doc in 0..index.meta.docs {
                let (local, en) = index.names(doc);
                let d = doc as usize;
                writeln!(
                    out,
                    "{} {}\t{}\t{}\t{}",
                    folded(local),
                    en.map(folded).unwrap_or_default(),
                    f32::from(index.importance()[d]) / 65535.0,
                    f64::from(index.lat()[d]) / 1e7,
                    f64::from(index.lon()[d]) / 1e7
                )?;
            }
            Ok(())
        }
        "http" => http(&args[3], &args[4], args[5].parse()?),
        other => anyhow::bail!("unknown mode {other}"),
    }
}

fn generate(index: &Index, n: usize, seed: u64) -> anyhow::Result<()> {
    let mut rng = Rng(seed | 1);
    let docs = u64::from(index.meta.docs);
    let mut out = std::io::BufWriter::new(std::io::stdout().lock());
    let mut made = 0;
    while made < n {
        // Skew towards well-known places, as real searches are.
        let doc = ((rng.unit().powi(3)) * docs as f64) as u32;
        let (local, en) = index.names(doc);
        let name = folded(if rng.below(3) == 0 {
            en.unwrap_or(local)
        } else {
            local
        });
        let chars: Vec<char> = name.chars().collect();
        if chars.len() < 3 || !name.is_ascii() {
            continue;
        }
        let d = doc as usize;
        let (lat, lon) = (
            f64::from(index.lat()[d]) / 1e7,
            f64::from(index.lon()[d]) / 1e7,
        );
        let (kind, text): (&str, String) = match rng.below(10) {
            // Someone typing: a prefix of the name, from 1 char up.
            0..=4 => (
                "prefix",
                chars[..1 + rng.below(chars.len() as u64) as usize]
                    .iter()
                    .collect(),
            ),
            5 | 6 => ("full", name.clone()),
            7 => {
                let mut c = chars.clone();
                let at = 1 + rng.below(c.len() as u64 - 1) as usize;
                match rng.below(3) {
                    0 => {
                        c.remove(at);
                    }
                    1 => c.insert(at, 'e'),
                    _ => c.swap(at - 1, at),
                }
                ("typo", c.into_iter().collect())
            }
            _ => {
                let ctx = index.context_label(index.context()[d]);
                let last = folded(ctx.rsplit(", ").next().unwrap_or(""));
                if last.is_empty() {
                    continue;
                }
                ("context", format!("{name} {last}"))
            }
        };
        // Most searches are for somewhere within a few hundred km.
        let near = match rng.below(10) {
            0 | 1 => None,
            2 => Some((rng.unit() * 120.0 - 50.0, rng.unit() * 360.0 - 180.0)),
            _ => Some((
                lat + (rng.unit() - 0.5) * 3.0,
                lon + (rng.unit() - 0.5) * 3.0,
            )),
        };
        let (qlat, qlon) = near.map_or((String::new(), String::new()), |(a, b)| {
            (format!("{a:.2}"), format!("{b:.2}"))
        });
        writeln!(out, "{kind}\t{text}\t{qlat}\t{qlon}\t{doc}")?;
        made += 1;
    }
    Ok(())
}

struct Case {
    kind: String,
    text: String,
    near: Option<(f64, f64)>,
    doc: u32,
}

fn load(path: &str) -> anyhow::Result<Vec<Case>> {
    let mut cases = Vec::new();
    for line in BufReader::new(std::fs::File::open(path)?).lines() {
        let line = line?;
        let f: Vec<&str> = line.split('\t').collect();
        cases.push(Case {
            kind: f[0].into(),
            text: f[1].into(),
            near: f[2].parse().ok().zip(f[3].parse().ok()),
            doc: f[4].parse()?,
        });
    }
    Ok(cases)
}

fn run(index: &Index, path: &str) -> anyhow::Result<()> {
    let cases = load(path)?;
    let mut all = Vec::new();
    let mut by_kind: std::collections::BTreeMap<String, (Vec<Duration>, usize, usize)> =
        Default::default();
    let mut slowest: Vec<(Duration, &Case)> = Vec::new();
    let wall = Instant::now();
    for case in &cases {
        let started = Instant::now();
        let hits = search(
            index,
            &Query {
                text: &case.text,
                near: case.near,
                limit: 8,
            },
        );
        let took = started.elapsed();
        all.push(took);
        slowest.push((took, case));
        let want = folded(index.names(case.doc).0);
        let found = hits
            .iter()
            .any(|h| h.doc == case.doc || folded(index.names(h.doc).0) == want);
        let entry = by_kind.entry(case.kind.clone()).or_default();
        entry.0.push(took);
        entry.1 += usize::from(found);
        entry.2 += 1;
    }
    let wall = wall.elapsed();
    for (kind, (times, found, total)) in &mut by_kind {
        report(kind, times);
        if kind != "prefix" {
            println!(
                "{:<22} source place in top 8: {:.1}%",
                "",
                100.0 * *found as f64 / *total as f64
            );
        }
    }
    report("ALL", &mut all);
    println!(
        "{:.0} queries/s on one thread",
        cases.len() as f64 / wall.as_secs_f64()
    );
    slowest.sort_by(|a, b| b.0.cmp(&a.0));
    for (took, case) in slowest.iter().take(5) {
        println!("slow: {took:?} {:?} near={:?}", case.text, case.near);
    }
    Ok(())
}

fn http(path: &str, addr: &str, threads: usize) -> anyhow::Result<()> {
    let cases = std::sync::Arc::new(load(path)?);
    let wall = Instant::now();
    let handles: Vec<_> = (0..threads)
        .map(|t| {
            let cases = cases.clone();
            let addr = addr.to_string();
            std::thread::spawn(move || -> anyhow::Result<Vec<Duration>> {
                let mut stream = std::net::TcpStream::connect(&addr)?;
                stream.set_nodelay(true)?;
                let mut times = Vec::new();
                let mut buf = vec![0u8; 1 << 16];
                for case in cases.iter().skip(t).step_by(threads) {
                    let mut q = String::new();
                    for b in case.text.bytes() {
                        if b.is_ascii_alphanumeric() {
                            q.push(b as char)
                        } else {
                            q.push_str(&format!("%{b:02X}"))
                        }
                    }
                    let near = case
                        .near
                        .map_or(String::new(), |(a, b)| format!("&lat={a}&lon={b}"));
                    let started = Instant::now();
                    write!(
                        stream,
                        "GET /api?q={q}{near} HTTP/1.1\r\nHost: bench\r\n\r\n"
                    )?;
                    // Read headers, then exactly content-length bytes.
                    let mut have = 0;
                    let body_at = loop {
                        let n = stream.read(&mut buf[have..])?;
                        anyhow::ensure!(n > 0, "connection closed");
                        have += n;
                        if let Some(p) = buf[..have].windows(4).position(|w| w == b"\r\n\r\n") {
                            break p + 4;
                        }
                    };
                    let head = String::from_utf8_lossy(&buf[..body_at]).to_lowercase();
                    let len: usize = head
                        .split("content-length: ")
                        .nth(1)
                        .and_then(|s| s.split("\r\n").next())
                        .and_then(|s| s.parse().ok())
                        .unwrap_or(0);
                    let mut remaining = (body_at + len).saturating_sub(have);
                    while remaining > 0 {
                        let n = stream.read(&mut buf)?;
                        anyhow::ensure!(n > 0, "connection closed");
                        remaining = remaining.saturating_sub(n);
                    }
                    times.push(started.elapsed());
                }
                Ok(times)
            })
        })
        .collect();
    let mut all = Vec::new();
    for h in handles {
        all.extend(h.join().unwrap()?);
    }
    let wall = wall.elapsed();
    report(&format!("HTTP x{threads}"), &mut all);
    println!("{:.0} requests/s", all.len() as f64 / wall.as_secs_f64());
    Ok(())
}

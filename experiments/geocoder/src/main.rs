//! Prototype geocoder for ATTrails. See README.md.

mod bench;
mod build;
mod filter;
mod index;
mod normalize;
mod parquet_io;
mod serve;
mod tantivy_engine;

use std::path::Path;

use anyhow::{Result, bail};

const USAGE: &str = "usage:
  geocoder filter <photon-dump.jsonl.zst|-> <out.jsonl.zst|->
  geocoder convert <filtered.jsonl.zst> <out.parquet>
  geocoder build <index-dir> <filtered.jsonl.zst>...
  geocoder query <index-dir> <text> [lat lon]
  geocoder serve <index-dir> [addr]
  geocoder bench <index-dir> [queries] [threads] [tantivy-dir]
  geocoder tantivy-build <tantivy-dir> [--sorted] <filtered.parquet|.jsonl.zst>...
  geocoder tantivy-query <tantivy-dir> <text> [lat lon]";

fn main() -> Result<()> {
    let args: Vec<String> = std::env::args().skip(1).collect();
    let arg = |i: usize| args.get(i).map(String::as_str);
    match (arg(0), arg(1)) {
        (Some("filter"), Some(input)) => {
            let input: Box<dyn std::io::Read + Send> = match input {
                "-" => Box::new(std::io::stdin()),
                path => Box::new(std::fs::File::open(path)?),
            };
            filter::run(input, arg(2).unwrap_or("-"))
        }
        (Some("convert"), Some(input)) => {
            // Re-encode filtered JSON lines as Parquet (for comparing formats).
            use std::io::BufRead;
            let start = std::time::Instant::now();
            let mut w = parquet_io::Writer::create(Path::new(arg(2).unwrap_or("out.parquet")))?;
            let f = std::fs::File::open(input)?;
            for line in std::io::BufReader::new(zstd::Decoder::new(f)?).lines() {
                w.push(serde_json::from_str(&line?)?)?;
            }
            w.finish()?;
            eprintln!("convert: done in {:?}", start.elapsed());
            Ok(())
        }
        (Some("load"), Some(_)) => {
            // Times reading + clustering only (for comparing input formats).
            let (records, _) = build::load(&args[1..])?;
            eprintln!("load: {} places", records.len());
            Ok(())
        }
        (Some("build"), Some(dir)) if args.len() > 2 => build::run(Path::new(dir), &args[2..]),
        (Some("query"), Some(dir)) => {
            let idx = index::Index::open(Path::new(dir))?;
            let focus = match (arg(3), arg(4)) {
                (Some(lat), Some(lon)) => Some((lat.parse()?, lon.parse()?)),
                _ => None,
            };
            let start = std::time::Instant::now();
            let hits = idx.search(&index::Query {
                text: arg(2).unwrap_or(""),
                focus,
                limit: 10,
            });
            let took = start.elapsed();
            for h in hits {
                println!(
                    "{:6.3}  {} — {}  [{}]  {},{}",
                    h.score, h.name, h.context, h.kind, h.lat, h.lon
                );
            }
            eprintln!("took {took:?}");
            Ok(())
        }
        (Some("serve"), Some(dir)) => {
            serve::run(Path::new(dir), arg(2).unwrap_or("127.0.0.1:8090"))
        }
        (Some("bench"), Some(dir)) => bench::run(
            Path::new(dir),
            arg(2).map_or(Ok(20_000), str::parse)?,
            arg(3).map_or(Ok(2), str::parse)?,
            arg(4).map(Path::new),
        ),
        (Some("tantivy-build"), Some(dir)) if args.len() > 2 => {
            let sorted = args.iter().any(|a| a == "--sorted");
            let inputs: Vec<String> = args[2..]
                .iter()
                .filter(|a| *a != "--sorted")
                .cloned()
                .collect();
            tantivy_engine::build(Path::new(dir), &inputs, sorted)
        }
        (Some("tantivy-query"), Some(dir)) => {
            let engine = tantivy_engine::TantivyEngine::open(Path::new(dir))?;
            let focus = match (arg(3), arg(4)) {
                (Some(lat), Some(lon)) => Some((lat.parse()?, lon.parse()?)),
                _ => None,
            };
            let start = std::time::Instant::now();
            let hits = engine.search(&index::Query {
                text: arg(2).unwrap_or(""),
                focus,
                limit: 10,
            });
            let took = start.elapsed();
            for h in hits {
                println!(
                    "{:6.3}  {} — {}  [{}]  {},{}",
                    h.score, h.name, h.context, h.kind, h.lat, h.lon
                );
            }
            eprintln!("took {took:?}");
            Ok(())
        }
        _ => bail!("{USAGE}"),
    }
}

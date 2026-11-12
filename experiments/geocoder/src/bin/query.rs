//! Runs queries from the command line: query <index> "<text>" [lat lon]

use std::path::Path;

use geocoder::index::Index;
use geocoder::search::{Query, search};

fn main() -> anyhow::Result<()> {
    let args: Vec<String> = std::env::args().collect();
    let index = Index::open(Path::new(&args[1]))?;
    let near = match (args.get(3), args.get(4)) {
        (Some(lat), Some(lon)) => Some((lat.parse()?, lon.parse()?)),
        _ => None,
    };
    let started = std::time::Instant::now();
    let hits = search(
        &index,
        &Query {
            text: &args[2],
            near,
            limit: 8,
        },
    );
    let took = started.elapsed();
    for h in &hits {
        let (local, en) = index.names(h.doc);
        let d = h.doc as usize;
        println!(
            "{:.3}  {:<38} {:<26} {}{}",
            h.score,
            match en {
                Some(en) => format!("{local} ({en})"),
                None => local.to_string(),
            },
            index.meta.kinds[index.kind()[d] as usize],
            index.context_label(index.context()[d]),
            h.distance_km
                .map_or(String::new(), |km| format!("  [{km:.0} km]")),
        );
    }
    println!("-- {} hits in {took:?}", hits.len());
    Ok(())
}

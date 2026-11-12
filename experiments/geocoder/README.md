# Geocoder experiment

A prototype answering one question: can ATTrails serve worldwide place search
from a small homelab box (under 4 GB RAM, 2 CPUs, p95 under 200 ms) instead of
running Photon, which recommends 64 GB RAM for the planet?

**Yes.** With the index limited to places people search for in an outdoor-routes
app, a memory-mapped index file and a small Rust server answer worldwide
queries at p95 ≈ 18 ms inside a 2 GB / 2 CPU limit, and still at p95 ≈ 50 ms
inside 512 MB.

This is an experiment, not production code. It is a standalone Cargo project,
outside the main workspace and its CI.

## Findings

Measured on 2026-11-12 against the Photon planet JSON dump dated 2026-11-08.

### Data

| | |
| --- | --- |
| Source | `photon-dump-planet-1.0-latest.jsonl.zst` from download1.graphhopper.com, 27.1 GB (959 GB decompressed) |
| Objects in the dump | 291.6 million |
| Kept by the filter | 12.2 million (4.2%) |
| Indexed after dropping canals, ponds and river segments | 11.1 million |
| Index file | 1.46 GB |

The dump is Nominatim's processed output: every object already has an
importance score, its enclosing city/county/state, and names in many
languages. That is what makes a small custom index practical; there is no need
to run Nominatim or parse raw OSM.

What is kept (`src/filter.rs`): settlements from countries down to hamlets and
named localities, administrative boundaries, peaks, passes, saddles, valleys,
ridges, glaciers, lakes, bays, beaches, capes, islands, waterfalls, parks,
nature reserves, national parks, forests, viewpoints, huts, camp sites,
attractions, trailheads and railway stations. Streets, house numbers, shops
and other POIs, which make up 96% of the dump, are left out.

### Pipeline cost (the monthly job)

| Step | Time | Peak memory |
| --- | --- | --- |
| Download and filter the planet dump (`extract`) | about 15 min at 30 MB/s, CPU-light | about 100 MB |
| Build the index (`build-index`) | 4 min 20 s, one thread | 3.3 GB |

The filtered intermediate file is 23.8 GB because it keeps every translation
of every address part; trimming those would shrink it several times over.

### Query latency

Workload: 20,000 synthetic queries made from indexed names, skewed towards
well-known places. Half are typeahead prefixes (from one character up), the
rest are full names, names with a typo, and names followed by a country. 80%
carry a location to bias towards. This is close to a worst case for memory,
because the queries are spread over the whole planet.

Server run in a cgroup that caps memory (page cache included) and CPU, with
the page cache dropped first:

| Memory cap | CPUs | Clients | p50 | p95 | p99 | Throughput |
| --- | --- | --- | --- | --- | --- | --- |
| 4 GB | 2 | 8 (saturating) | 4.0 ms | 63 ms | 91 ms | 605 req/s |
| 2 GB | 2 | 2 | 0.6 ms | 18 ms | 36 ms | 600 req/s |
| 1 GB | 2 | 2 | 1.2 ms | 19 ms | 40 ms | 490 req/s |
| 512 MB | 2 | 1 | 6.2 ms | 50 ms | 135 ms | 72 req/s |
| 512 MB | 2 | 8 (saturating) | 63 ms | 217 ms | 424 ms | 96 req/s |

The process's own (anonymous) memory is 20 to 75 MB. Everything else is the
kernel's page cache for the index file, which is why a cap below the file size
still works: cold pages are simply read again from disk.

How often the place a query was made from comes back in the top 8: 99% for
full names and name-plus-country, 82% for names with a typo.

### The same data in Postgres

The 11.1 million names were loaded into Postgres 16 with the `tsvector` prefix
search ATTrails already uses for route names (`to_tsquery('simple', 'san:*')`,
ordered by importance), with no memory limit, no location bias and no typo
tolerance:

| | p50 | p95 | p99 |
| --- | --- | --- | --- |
| Postgres `tsvector` + GIN | 1 ms | 400 ms | 650 ms |
| This prototype (in-process, with location bias and typo tolerance) | 0.3 ms | 17 ms | 36 ms |

Short prefixes are the problem: Postgres has to fetch and sort every match
before it can return the best eight. Table plus indexes took 1.9 GB.

### Not measured

- **Photon on the filtered data.** Photon can import a preprocessed JSON dump,
  so the 12 million filtered objects could be fed to stock Photon. That would
  likely fit in a few GB, but it still carries a JVM and OpenSearch. It could
  not be tested here because GitHub release downloads were blocked.
- **Result quality against real searches.** The workload is synthetic. Spot
  checks look right ("lake tah", "paris texas", "springfield il", "zermat",
  "richmond" near London vs near Virginia), but ranking weights were tuned by
  eye.

## How it works

- **Documents are numbered by descending importance.** Every posting list is a
  sorted array of document ids, so it is also sorted best-first, and a query
  without a location can stop after the first few hundred matches.
- **Term dictionary** is an FST (`fst` crate) over three namespaces: full
  tokens, prefixes of one to four characters with precomputed posting lists,
  and context tokens. Longer prefixes are answered by a range scan of the FST.
- **Context** ("paris texas", "springfield il") is not indexed per place. Each
  place points at one of about 500,000 distinct city/county/state/country
  combinations, which have their own small token index. Trailing query words
  that do not match the name are matched against that instead.
- **Location bias** adds a distance-decay bonus to importance. With a location
  the scan continues until no remaining place could beat the current results
  even if it were next door.
- **Typos** are only considered when exact matching finds nothing, and only
  for words that are not in the dictionary: Levenshtein automata over the FST,
  plus swapped neighbouring letters.
- **Columns** (latitude, longitude, importance, kind, context, bounding box)
  are flat arrays read straight from the memory map.

## Known gaps

- No reverse geocoding (coordinates to a place name).
- Only the local and English names are stored for display. All languages are
  searchable.
- Names in scripts without spaces (Chinese, Japanese, Thai) are one token, so
  only matches from the start of the name work.
- Posting lists are uncompressed `u32`s (600 MB of the file). Block compression
  would roughly halve the file.
- Short prefixes with a location scan up to 200,000 places; this is the p95.
- The index format has no checksum or version negotiation.
- OSM data is ODbL: results need "© OpenStreetMap contributors" attribution.

## Running it

```bash
cargo build --release
```

Filter the planet dump. `scripts/fetch.py` downloads with parallel range
requests, since a single connection was throttled to about 2 MB/s:

```bash
python3 scripts/fetch.py https://download1.graphhopper.com/public/photon-dump-planet-1.0-latest.jsonl.zst 10 \
  | target/release/extract histogram.tsv > planet.ext.jsonl
```

Country names come from the dump's second line. Any regional dump has it:

```bash
curl -s https://download1.graphhopper.com/public/europe/andorra/photon-dump-andorra-1.0-latest.jsonl.zst \
  | zstd -dc | sed -n 2p | jq .content > countries.json
```

Build and serve:

```bash
target/release/build-index planet.ext.jsonl countries.json planet.idx --no-kind waterway=canal --no-kind water=pond
```

```bash
target/release/serve planet.idx 0.0.0.0:2322
```

```bash
curl 'localhost:2322/api?q=lake%20tah&lat=39.1&lon=-120.0'
```

The response is a GeoJSON FeatureCollection shaped like Photon's `/api`.

Benchmark:

```bash
target/release/bench planet.idx gen 20000 42 > queries.tsv
```

```bash
target/release/bench planet.idx run queries.tsv
```

```bash
target/release/bench planet.idx http queries.tsv 127.0.0.1:2322 2
```

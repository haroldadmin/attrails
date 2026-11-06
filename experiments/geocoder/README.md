# Geocoder experiment

**Question:** can ATTrails self-host a worldwide place search on a homelab
with **< 4 GB RAM, ≤ 2 CPUs and p95 < 200 ms**?

**Answer: yes, with lots of room to spare.** This prototype indexes **11.2M
places worldwide in 1.2 GB** and answers search-as-you-type queries in
**p95 ≈ 4 ms on 2 cores**. It still has p95 < 50 ms when squeezed into
384 MB of total memory.

> Status: prototype. It sits outside the Cargo workspace on purpose, so it
> does not affect CI or the main build. Not intended to be merged; the
> findings feed a production implementation.

> **Update (spike 2):** a Tantivy-based engine, with the index sorted by
> importance, beat the custom index: **p95 1.3 ms** and much better
> behaviour under memory pressure. Parquet is a good fit for the hand-off
> between filter and build. See [Spike 2](#spike-2-tantivy-and-parquet).

---

## TL;DR

| | Photon (planet) | This prototype (planet) |
|---|---|---|
| Records indexed | ~290M (incl. houses, streets) | **11.2M** (places trail users search for) |
| Index on disk | 63 GB | **1.2 GB** |
| Recommended RAM | up to 64 GB | **~1.5 GB** (works down to ~400 MB) |
| Runtime | JVM + OpenSearch | One static Rust binary + mmapped files |
| p95 latency, 2 cores | n/a (not tested) | **3.8 ms** |

- **Why it's so much smaller:** ~95% of a geocoder's data is house numbers
  and streets. Trail users search for towns, peaks, parks, lakes, passes,
  huts and trailheads, so we drop the rest.
- **Why it needs so little RAM:** the index is read-only and memory-mapped.
  The OS page cache holds the hot parts and nothing is loaded onto a heap.
- **Monthly build:** ~10 min to filter the 27 GB planet dump, plus ~3 min
  to build the index. The download itself takes ~6 min with parallel
  connections.

---

## Measurements

All numbers are from the real **planet** Photon dump
(`photon-dump-planet-1.0-latest.jsonl.zst`, 2026-11-02) on a 4-core VM.
Serving benchmarks were pinned to 2 cores with `taskset -c 0,1`.

### Pre-processing (monthly, on a big machine)

| Step | Input → output | Time | Peak RAM |
|---|---|---|---|
| Download | 27 GB `.jsonl.zst` | ~6 min (aria2c, 16 connections) | n/a |
| `filter` | 291M records (~550 GB uncompressed) → 12.8M places (472 MB) | 9.6–10 min | 7.7 GB ¹ |
| `build` | 12.8M → 11.2M places after merging duplicates → 1.2 GB index | 2.8 min | 11.4 GB |

¹ Most of this is probably buffering, not real work: batches of 20k raw
lines sit in an 8-deep channel, and some single lines (country borders)
are hundreds of MB. Parsing `content` as raw JSON instead of a `Value` tree
did not change the peak (7.6 → 7.7 GB, same output). Not fixed yet:
batching by bytes instead of line count, with a shorter channel, should
bring it down to a few hundred MB.

### Serving (homelab budget: 2 cores)

The benchmark simulates typing: every keystroke of a place name is a
query. Half the places come from the top 20k by importance and half from
the long tail. Half the queries carry a location bias, like the one
ATTrails gets from Cloudflare's `cf-iplatitude`/`cf-iplongitude` headers.

| Memory available (cgroup limit, cold start) | p50 | p95 | p99 | Throughput |
|---|---|---|---|---|
| Unlimited (index fully cached) | 0.55 ms | **3.8 ms** | 4.5 ms | 1,750 q/s |
| 2 GB | 0.61 ms | **3.8 ms** | 4.7 ms | 1,670 q/s |
| 768 MB (index does **not** fit) | 1.8 ms | **9.6 ms** | 14 ms | 710 q/s |
| 384 MB (heavy disk reads) | 3.8 ms | **44 ms** | 63 ms | 180 q/s |

- The cgroup limit counts page cache, so the 768 MB and 384 MB rows really
  do evict index pages and re-read them from disk.
- This VM has a fast disk. On an SD card or spinning disk, the
  "doesn't fit" rows would be slower. With ≥ 1.5 GB free for page cache,
  disk speed doesn't matter.
- **Recall@5:** when the full name is typed with a location nearby, the
  place is in the top 5 for **97%** of queries.
- Server RSS (excluding page cache) is ~13 MB.

---

## How it works

```
 monthly, big machine                              homelab
┌──────────────────────────────────────────┐     ┌───────────────────────┐
│ photon-dump-planet.jsonl.zst (27 GB)      │     │ geocoder serve         │
│        │                                  │     │  mmap(index/*)         │
│        ▼  geocoder filter                 │     │  GET /search?q=&lat=&lon│
│ places.jsonl.zst (472 MB, 12.8M places)   │ ──▶ │                        │
│        │                                  │ rsync │  ~1.2 GB page cache   │
│        ▼  geocoder build                  │     │  ~13 MB RSS            │
│ index/ (1.2 GB)                           │     └───────────────────────┘
└──────────────────────────────────────────┘
```

### 1. Input: Photon's JSON dump

GraphHopper publishes a monthly
[Photon JSON dump](https://download1.graphhopper.com/public/). It is
OpenStreetMap data that Nominatim has already processed, so each place
comes with:

- names in many languages, `alt_name`, `short_name`, ...
- the address hierarchy (city, county, state, country)
- an `importance` score (Wikipedia-derived, 0..1)
- centroid and bbox

That saves us from running Nominatim/Postgres ourselves. Regional dumps
exist too (e.g. `europe/austria/`), which are handy for testing.

### 2. `filter`: keep what trail users search for

An allowlist in `src/filter.rs` keeps the following, if they have a name:

- **Settlements:** country, state, county, city, town, village, hamlet,
  suburb, neighbourhood, locality, island
- **Admin and protected areas:** national parks, nature reserves, parks
- **Natural features:** peaks, volcanoes, saddles, ridges, valleys,
  glaciers, lakes, rivers, waterfalls, beaches, bays, capes, springs,
  caves, woods
- **Outdoor infrastructure:** mountain passes, alpine/wilderness huts,
  viewpoints, camp sites, trailheads, named paths, cycleways and
  bridleways, train stations, cable-car stations
- **A few destinations:** castles, monuments, archaeological sites

Everything else is dropped: houses, streets, shops, restaurants, bus stops.

Biggest kept groups on the planet: localities 2.0M, hamlets 1.7M,
villages 1.6M, named paths 0.86M, rivers 0.75M, peaks 0.70M, parks 0.62M.

Speed: the filter rejects lines by looking at `osm_key`/`osm_value` in the
raw bytes, *before* JSON parsing. It decompresses on one thread and
filters on all cores. Throughput is ~1 GB/s of uncompressed JSON.

### 3. `build`: a memory-mappable index

- **Merge duplicates.** A river is hundreds of way segments, and a peak can
  be both a node and an area. Places with the same name and kind within a
  few km are merged, keeping the most important one and the merged bbox
  (12.8M → 11.2M).
- **Sort by importance.** Doc id 0 is the most important place in the
  world. That means **every posting list is already in rank order**, so
  reading the first N ids of a list gives the N best matches. We never have
  to score millions of documents.
- **Files:**

| File | Size | What |
|---|---|---|
| `docs.bin` | 225 MB | 20 bytes per place: lat, lon, kind, importance, offsets |
| `payload.bin` | 578 MB | display name, OSM id, bbox, normalised names |
| `contexts.bin` | 50 MB | 504k de-duplicated "City, State, Country" labels |
| `terms.fst` | 143 MB | [FST](https://docs.rs/fst) term dictionary (19M keys) |
| `postings.bin` | 232 MB | delta-varint doc id lists |

- **FST keys:**
  - `T`+token: all places with that name token
  - `P`+prefix: top 256 places for every 1–3 character prefix (so typing
    "s" never expands a million terms)
  - `G`+cell+token and `Q`+cell+prefix: the same per 2° grid cell, so
    **nearby** places surface even if they're globally obscure

### 4. Query (`src/index.rs`)

1. **Normalise:** lowercase, strip accents (`Großglockner` →
   `grossglockner`), split into tokens. The last token is a prefix unless
   the query ends in a space.
2. **Gather candidates:** for each token, read the first few hundred ids
   globally, plus from the user's grid cell and its 8 neighbours.
3. **Verify:** every token must match the place's name or its context, so
   "innsbruck tirol" and "springfield illinois" work.
4. **Rank:** name match quality + importance + a small boost by kind
   (cities > hamlets, paths slightly down) + distance decay from the
   user's location (≈75 km scale).

---

## Quality: sample results (planet index)

Working well:

- `san fran` → San Francisco, CA
- `ben nev` → Ben Nevis
- `chamonix` → Chamonix-Mont-Blanc
- `kilimanj` → Kilimanjaro
- `torres del` → Torres del Paine NP (2nd)
- `appalachian` → Appalachian Mountains, Appalachian National Scenic Trail
- `grossglockner`, `hallst` (Hallstatt + Hallstätter See), `dachst`
- `springfield` near Illinois → Springfield, IL first; near Massachusetts
  → Springfield, MA first
- `vienna` → Wien, via `name:en`
- `innsbruck tirol`, via context and local state names
- `東京` → Tokyo

Known gaps, all fixable:

| Gap | Example | Fix |
|---|---|---|
| Abbreviations | `mt whitney` → nothing (`mount whit` works) | Synonym table at build time: mt↔mount, st↔saint↔sankt, lk↔lake, ... |
| Ranking: famous parks lose to same-named hamlets | `yosemite` → a hamlet first, the NP 3rd; `zion` → Zion NP not in top 4 | Boost `national_park`/`nature_reserve` and use the Wikipedia importance better; build a small hand-checked eval set |
| Long-distance trails are mostly missing | `pacific crest` → a reservoir, not the PCT | Photon doesn't include OSM `route=hiking/bicycle` relations. Add them from the OSM planet PBF with `osmium` (one extra monthly step) |
| Display language | Tokyo is shown as `東京都` | Pick `name:<lang>` at query time (store `name:en`, use `Accept-Language`) |
| No typo tolerance | `kilimajaro` → nothing | Levenshtein automaton over the FST (`fst` supports it), only for tokens ≥ 5 chars |
| CJK tokenisation | Japanese/Chinese only match from the start of a name | Character bigrams for CJK scripts |

---

## Alternatives considered

| Option | Verdict |
|---|---|
| **Photon** with the full planet | Too big: 63 GB index, JVM + OpenSearch, needs tens of GB of RAM |
| **Photon** with a filtered dump (pipe our filtered JSON into `photon import`) | Plausible, zero custom search code. But it's still a JVM + embedded OpenSearch, and fitting it in 4 GB is tight. Worth a benchmark if we'd rather not own search code. (Couldn't test here: the GitHub release download was blocked.) |
| **Nominatim** | Needs Postgres with the planet imported. Far too heavy |
| **Pelias** | Elasticsearch + several services. Too heavy |
| **Pelias Placeholder** | Small (SQLite), but only admin areas (Who's On First). No peaks, parks or trails |
| **Typesense / Meilisearch** | Easy to run, but Typesense keeps everything in RAM, and both would need tuning at 11M docs. Less control over geo-biased ranking |
| **Tantivy** (Rust Lucene) | **Recommended** after spike 2. Scoring every match is too slow, but with the index sorted by importance and early termination it beats the custom index. See [Spike 2](#spike-2-tantivy-and-parquet) |
| **Custom FST + importance-ordered postings (this)** | Small, fast, predictable. We own ~1,300 lines of Rust (including the benchmark) |

---

## Spike 2: Tantivy and Parquet

Same data (the filtered planet, 11.2M places after merging), same
benchmark (100k search-as-you-type queries on 2 pinned cores), same final
reranker. Only candidate retrieval differs.

### Three engines

| Engine | How candidates are found |
|---|---|
| **Custom** (`src/index.rs`) | FST + importance-ordered postings. Reads the first N ids per query token, globally and per grid cell, then verifies all tokens |
| **Tantivy, scored** (`tantivy-build`) | Edge n-gram field for the word being typed. A `BooleanQuery` requires all tokens; `TopDocs::tweak_score` scores **every** match by importance + kind + distance |
| **Tantivy, sorted** (`tantivy-build --sorted`) | Same fields and query, but `IndexSettings::sort_by_field = importance desc`, so doc order is rank order. Walks the matching docs and **stops** after 300 globally plus 200 within the user's grid cells (a `cell` term field) |

All three rerank their top 50 with the same text scoring (`text_score`)
and the same importance/kind/distance score (`static_score`).

### Results (planet, warm page cache, 2 cores)

| Engine | Index size | p50 | p95 | p99 | Throughput | Recall@5 |
|---|---|---|---|---|---|---|
| Custom | 1.2 GB | 0.62 ms | 3.9 ms | 4.7 ms | 1,700 q/s | 97.7% |
| **Tantivy, sorted** | 1.5 GB | **0.35 ms** | **1.3 ms** | **2.5 ms** | **4,400 q/s** | **98.2%** |
| Tantivy, scored | 1.5 GB | 0.47 ms | 57 ms | 135 ms | 216 q/s | 98.3% |

### Under memory pressure (cold start, cgroup cap counts page cache)

| Cap | Custom p95 | Tantivy sorted p95 |
|---|---|---|
| 2 GB | 4.0 ms | 1.5 ms |
| 768 MB | 10.2 ms | 3.8 ms |
| 384 MB | 48 ms | **9.3 ms** |

The cap was verified (the cgroup peak reached each limit). Tantivy-sorted
stays fast with less memory, most likely because sorting by importance puts
the popular places at the start of every file, so the hot set is small and
contiguous.

### Why each result came out this way

- **Scored is slow at the tail.** A 1–2 letter prefix matches millions of
  docs, and every one is scored. p50 is fine; p95/p99 is not.
- **Sorted wins because:**
  - Edge n-grams turn the typed prefix into one term lookup, with no FST
    expansion (which was ~50% of the custom engine's CPU).
  - The AND query is more selective than the custom engine's
    "one token drives, verify the rest".
  - Early termination gives the same "first N = best N" trick.
- **Cost:** the index is ~25% bigger (1.5 vs 1.2 GB), mostly the
  LZ4 document store (790 MB) and edge n-gram postings.

### Pitfalls found (worth knowing for production)

1. **Open fast-field columns once, not per query.** Opening a column
   decodes its block index. Doing that per query cost ~35 ms. Cache the
   `Arc<dyn ColumnValues>` per segment at startup (`SegCols`).
2. **Disable the background merge policy** (`NoMergePolicy`) when doing one
   explicit final merge. Otherwise the two race:
   "segments that were merged could not be found", plus orphaned segment
   files that tripled the index size on disk.
3. **Early termination isn't a collector feature.** Walk the `DocSet` from
   `weight.scorer(...)` and stop yourself. Collectors visit every match.

### Parquet as the filter → build hand-off

| | zstd JSON lines | Parquet (zstd) |
|---|---|---|
| Size (12.8M places) | 472 MB | 528 MB |
| Read into records | 20 s | **12.5 s** (1.6× faster) |
| Writer peak RAM | n/a | 186 MB (streamed in 64k-row groups) |
| Queryable with SQL | no | **yes (DuckDB, < 0.1 s per query)** |

- `filter` writes Parquet when the output ends in `.parquet`, and both
  builders read either format. Country names travel in the Parquet
  key-value metadata.
- The planet Parquet was produced with `convert` from the filtered JSON
  lines, since there wasn't disk for another 27 GB dump. The
  filter → Parquet path itself was verified end to end on Andorra.
- Read time is dominated by turning columns into owned `Record` structs.
  Reading Arrow columns directly would be faster still.

**DuckDB is the bigger win.** It makes the allowlist and ranking easy to
audit. For example:

```sql
SELECT kind, count(*) FROM 'planet.parquet' GROUP BY 1 ORDER BY 2 DESC;
SELECT name, cc, importance FROM 'planet.parquet'
  WHERE kind = 'natural=peak' ORDER BY importance DESC LIMIT 5;
```

The second query immediately surfaced a data-quality question: "El Cabezo"
(Spain) and "Soum d'Ypy" (France) have the same importance as Mont Blanc.

### The build machine's memory goes to loading, not indexing

Loading + clustering the 12.8M records peaks at **11.4 GB** whichever
format they come from. Building either index adds little on top. So the
production build should not materialise every record as a Rust struct.
Doing the duplicate merging in DuckDB (SQL over Parquet) and streaming
rows into Tantivy would likely cut this by an order of magnitude. Not
tested.

### Recommendation for production

- **Engine:** Tantivy with the index sorted by importance, edge n-grams and
  early termination.
- **Pipeline:** Photon dump → `filter` → Parquet → (DuckDB: audit, merge
  duplicates) → Tantivy index.
- **Next to try:** Tantivy's fuzzy (Levenshtein) term queries for typo
  tolerance, and whether `docstore_compression: none` or a smaller block
  size helps the rerank fetch.

---

## Running it on the homelab

- **Deploy:** one binary plus an `index/` directory (1.2 GB). It runs in a
  `scratch`/distroless container. Give the container ~1.5–2 GB of memory
  so the whole index stays cached.
- **Monthly refresh:**
  1. Build the new index into `index-YYYYMM/`.
  2. `rsync` it to the homelab.
  3. Flip a symlink and restart. Startup takes ~0.2 ms (it only mmaps
     files), so there's no warm-up beyond the page cache filling.
- **Where to build:**
  - Any machine with **~12 GB RAM** and **~30 GB disk** (or stream the
    download straight into `filter` and need no disk).
  - A GitHub-hosted runner (16 GB RAM) would likely work if the download
    is streamed. Not tested.
  - Build RAM could be cut a lot by building posting lists externally;
    there's been no need yet.
- **Download tip:** a single HTTP connection to the dump server ran at
  ~1 MB/s, while 16 parallel range requests (`aria2c -x16 -s16`) ran at
  ~70 MB/s.

## Integrating with ATTrails

- Add a Next.js route handler (e.g. `/api/places?q=`) that proxies to the
  geocoder. Pass `lat`/`lon` from `approximateLocation()` in
  `web/src/lib/location.ts`, which already reads the Cloudflare headers.
- A search box on the home or discover page then:
  1. **Point results** (peak, town) → `loadRoutesNear(location, ...)`
     (`web/src/lib/routes/queries.ts`).
  2. **Area results** (national park, region) → query routes in the
     returned `bbox`.
- Keep the geocoder private behind the web app. That way rate limiting
  and caching live in one place.
- **Bonus:** the same grid cells make a cheap **reverse geocoder** ("route
  near Hallstatt, Austria") for labelling route start points during
  ingestion.

## Licensing

- Data is © OpenStreetMap contributors, under the
  [ODbL](https://opendatacommons.org/licenses/odbl/). Photon dumps are
  derived from OSM.
- Any UI showing results must show OSM attribution.
- The index is a derivative database. If we share it publicly, it must be
  under the ODbL. Serving search results from it is fine with attribution.

---

## Reproduce

```bash
cargo build --release
```

Filter the dump:

```bash
./target/release/geocoder filter photon-dump-planet-1.0-latest.jsonl.zst planet.places.zst
```

Build the index:

```bash
./target/release/geocoder build index planet.places.zst
```

Try one query (optionally with a latitude/longitude bias):

```bash
./target/release/geocoder query index "hallst" 47.8 13.0
```

Filter straight to Parquet, or convert existing JSON lines:

```bash
./target/release/geocoder filter photon-dump-planet-1.0-latest.jsonl.zst planet.parquet
```

```bash
./target/release/geocoder convert planet.places.zst planet.parquet
```

Build the Tantivy index (sorted by importance) and query it:

```bash
./target/release/geocoder tantivy-build tindex --sorted planet.parquet
```

```bash
./target/release/geocoder tantivy-query tindex "hallst" 47.8 13.0
```

Benchmark Tantivy with the same queries as the custom index (the custom
index generates the queries):

```bash
taskset -c 0,1 ./target/release/geocoder bench index 100000 2 tindex
```

Run the benchmark on 2 cores:

```bash
taskset -c 0,1 ./target/release/geocoder bench index 100000 2
```

Serve over HTTP:

```bash
./target/release/geocoder serve index 0.0.0.0:8090
```

Download the planet dump quickly:

```bash
aria2c -x 16 -s 16 -k 64M https://download1.graphhopper.com/public/photon-dump-planet-1.0-latest.jsonl.zst
```

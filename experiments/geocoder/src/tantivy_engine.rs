//! Spike: the same search on top of Tantivy, for comparison with the custom
//! index in `index.rs`.
//!
//! This is the idiomatic Tantivy setup for search-as-you-type:
//!
//! - `name_tok`: every normalised name token (exact matches).
//! - `name_pre`: edge n-grams of every name token, 1..=[`MAX_PREFIX`] chars,
//!   so the word being typed is a single term lookup (no FST expansion).
//! - `ctx_tok`: "City, State, Country" tokens, so "innsbruck tirol" works.
//! - Fast fields `importance`, `lat`, `lon`, `kind` for scoring.
//!
//! A query requires every token in the name or context, and at least one in
//! the name. `TopDocs::tweak_score` ranks **every** matching document by the
//! same importance + kind + distance score as the custom engine. The top
//! [`RERANK`] are then reranked with the exact same text scoring
//! ([`crate::index::text_score`]), so the only difference between the engines
//! is how candidates are found.
//!
//! Tokens are produced by our own normaliser and fed in pre-tokenised, so
//! both engines see identical terms.
//!
//! **Sorted variant** (`tantivy-build --sorted`): the index is sorted by
//! importance (`IndexSettings::sort_by_field`), so doc order is rank order,
//! as in the custom engine. Search then walks the matching docs in order
//! and stops after the first [`GLOBAL_TAKE`] (plus [`LOCAL_TAKE`] restricted
//! to the user's grid cells via the `cell` field) instead of scoring every
//! match.

use std::collections::{HashMap, HashSet};
use std::path::Path;
use std::sync::Arc;

use anyhow::{Context, Result};
use tantivy::collector::TopDocs;
use tantivy::columnar::ColumnValues;
use tantivy::index::SegmentId;
use tantivy::query::{BooleanQuery, EnableScoring, Occur, Query as TQuery, TermQuery};
use tantivy::schema::{
    FAST, Field, IndexRecordOption, STORED, Schema, TextFieldIndexing, TextOptions, Value,
};
use tantivy::tokenizer::{PreTokenizedString, Token};
use tantivy::{
    DocAddress, DocId, DocSet, Index, IndexReader, IndexSettings, IndexSortByField, Order, Score,
    Searcher, SegmentReader, TERMINATED, TantivyDocument, Term,
};

use crate::build::{cell, context_label, context_norm, load};
use crate::index::{Hit, Query, static_score, text_score};
use crate::normalize::{char_prefix, tokens};

/// Longest edge n-gram indexed. Longer typed words are truncated to this for
/// retrieval; the reranker still checks the full word.
const MAX_PREFIX: usize = 12;
/// How many top-scored matches get reranked with full text scoring.
const RERANK: usize = 50;
/// Sorted variant: matches read in rank order, globally and near the user.
const GLOBAL_TAKE: usize = 300;
const LOCAL_TAKE: usize = 200;

struct Fields {
    name_tok: Field,
    name_pre: Field,
    ctx_tok: Field,
    importance: Field,
    lat: Field,
    lon: Field,
    kind: Field,
    name: Field,
    context: Field,
    osm: Field,
    names_norm: Field,
    ctx_norm: Field,
    bbox: Field,
    cell: Field,
}

fn schema() -> (Schema, Fields) {
    let mut b = Schema::builder();
    // Doc ids only: no term frequencies, positions or field norms.
    let terms = TextOptions::default().set_indexing_options(
        TextFieldIndexing::default()
            .set_tokenizer("raw")
            .set_index_option(IndexRecordOption::Basic)
            .set_fieldnorms(false),
    );
    let fields = Fields {
        name_tok: b.add_text_field("name_tok", terms.clone()),
        name_pre: b.add_text_field("name_pre", terms.clone()),
        ctx_tok: b.add_text_field("ctx_tok", terms),
        importance: b.add_f64_field("importance", FAST),
        lat: b.add_f64_field("lat", FAST),
        lon: b.add_f64_field("lon", FAST),
        kind: b.add_u64_field("kind", FAST),
        name: b.add_text_field("name", STORED),
        context: b.add_text_field("context", STORED),
        osm: b.add_text_field("osm", STORED),
        names_norm: b.add_text_field("names_norm", STORED),
        ctx_norm: b.add_text_field("ctx_norm", STORED),
        bbox: b.add_text_field("bbox", STORED),
        cell: b.add_u64_field("cell", tantivy::schema::INDEXED),
    };
    (b.build(), fields)
}

fn pre_tokenized(terms: impl IntoIterator<Item = String>) -> PreTokenizedString {
    let tokens = terms
        .into_iter()
        .enumerate()
        .map(|(i, text)| Token {
            offset_from: 0,
            offset_to: 0,
            position: i,
            text,
            position_length: 1,
        })
        .collect();
    PreTokenizedString {
        text: String::new(),
        tokens,
    }
}

/// Builds a Tantivy index in `out_dir` from filtered records.
pub fn build(out_dir: &Path, inputs: &[String], sorted: bool) -> Result<()> {
    std::fs::create_dir_all(out_dir)?;
    let (records, countries) = load(inputs)?;
    let (schema, f) = schema();
    let settings = IndexSettings {
        sort_by_field: sorted.then(|| IndexSortByField {
            field: "importance".to_owned(),
            order: Order::Desc,
        }),
        ..IndexSettings::default()
    };
    let index = Index::builder()
        .schema(schema)
        .settings(settings)
        .create_in_dir(out_dir)
        .context("creating tantivy index")?;
    let mut writer = index.writer_with_num_threads(4, 2_000_000_000)?;
    // Merge once, explicitly, at the end. The default policy would merge
    // the same segments in the background and race the explicit merge.
    writer.set_merge_policy(Box::new(tantivy::indexer::NoMergePolicy));
    let mut kinds: Vec<String> = Vec::new();
    let start = std::time::Instant::now();
    for r in &records {
        let kind = kinds.iter().position(|k| *k == r.kind).unwrap_or_else(|| {
            kinds.push(r.kind.clone());
            kinds.len() - 1
        });
        let label = context_label(r, &countries);
        let ctx_norm = context_norm(r, &label);
        let mut name_tokens: HashSet<String> = HashSet::new();
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
            name_tokens.extend(t);
        }
        let mut prefixes: HashSet<String> = HashSet::new();
        for t in &name_tokens {
            for n in 1..=MAX_PREFIX {
                if let Some(p) = char_prefix(t, n) {
                    prefixes.insert(p.to_owned());
                }
            }
        }
        let ctx_terms: HashSet<String> = ctx_norm.split(' ').map(str::to_owned).collect();

        let mut doc = TantivyDocument::new();
        doc.add_pre_tokenized_text(f.name_tok, pre_tokenized(name_tokens));
        doc.add_pre_tokenized_text(f.name_pre, pre_tokenized(prefixes));
        doc.add_pre_tokenized_text(f.ctx_tok, pre_tokenized(ctx_terms));
        doc.add_f64(f.importance, f64::from(r.importance));
        doc.add_f64(f.lat, r.lat);
        doc.add_f64(f.lon, r.lon);
        doc.add_u64(f.kind, kind as u64);
        doc.add_u64(f.cell, u64::from(cell(r.lat, r.lon)));
        doc.add_text(f.name, &r.name);
        doc.add_text(f.context, &label);
        doc.add_text(f.osm, &r.osm);
        doc.add_text(f.names_norm, norm_names.join("|"));
        doc.add_text(f.ctx_norm, &ctx_norm);
        if let Some(b) = r.bbox {
            doc.add_text(f.bbox, format!("{},{},{},{}", b[0], b[1], b[2], b[3]));
        }
        writer.add_document(doc)?;
    }
    writer.commit()?;
    eprintln!(
        "tantivy: indexed {} docs in {:?}",
        records.len(),
        start.elapsed()
    );
    // Merge into a single segment, as the custom index is.
    let ids = index.searchable_segment_ids()?;
    if ids.len() > 1 {
        writer.merge(&ids).wait()?;
    }
    writer.wait_merging_threads()?;
    // Delete the files of the segments that were merged away.
    let writer: tantivy::IndexWriter = index.writer_with_num_threads(1, 50_000_000)?;
    writer.garbage_collect_files().wait()?;
    drop(writer);
    std::fs::write(out_dir.join("kinds.json"), serde_json::to_vec(&kinds)?)?;
    eprintln!("tantivy: done in {:?}", start.elapsed());
    Ok(())
}

/// Fast-field readers for one segment. Opening a column decodes its block
/// index (for 11M docs that's tens of milliseconds), so this is done once at
/// startup, never per query.
struct SegCols {
    importance: Arc<dyn ColumnValues<f64>>,
    lat: Arc<dyn ColumnValues<f64>>,
    lon: Arc<dyn ColumnValues<f64>>,
    kind: Arc<dyn ColumnValues<u64>>,
}

impl SegCols {
    fn open(seg: &SegmentReader) -> Result<Self> {
        let ff = seg.fast_fields();
        let f = |name: &str| -> Result<_> { Ok(ff.f64(name)?.first_or_default_col(0.0)) };
        Ok(Self {
            importance: f("importance")?,
            lat: f("lat")?,
            lon: f("lon")?,
            kind: ff.u64("kind")?.first_or_default_col(0),
        })
    }

    #[allow(clippy::cast_possible_truncation)]
    fn static_score(&self, doc: DocId, kinds: &[String], focus: Option<(f64, f64)>) -> f32 {
        static_score(
            self.importance.get_val(doc) as f32,
            &kinds[self.kind.get_val(doc) as usize],
            self.lat.get_val(doc) as f32,
            self.lon.get_val(doc) as f32,
            focus,
        )
    }
}

pub struct TantivyEngine {
    searcher: Searcher,
    f: Fields,
    kinds: Arc<Vec<String>>,
    sorted: bool,
    /// Per segment, by segment ordinal.
    cols: Arc<Vec<SegCols>>,
    /// Segment id -> ordinal, for the `tweak_score` callback.
    ords: Arc<HashMap<SegmentId, usize>>,
}

impl TantivyEngine {
    pub fn open(dir: &Path) -> Result<Self> {
        let index = Index::open_in_dir(dir)?;
        let sorted = index.settings().sort_by_field.is_some();
        let (_, f) = schema();
        let reader: IndexReader = index.reader()?;
        let searcher = reader.searcher();
        let segs = searcher.segment_readers();
        let cols = segs.iter().map(SegCols::open).collect::<Result<Vec<_>>>()?;
        let ords = segs
            .iter()
            .enumerate()
            .map(|(i, s)| (s.segment_id(), i))
            .collect();
        Ok(Self {
            sorted,
            searcher,
            f,
            kinds: Arc::new(serde_json::from_slice(&std::fs::read(
                dir.join("kinds.json"),
            )?)?),
            cols: Arc::new(cols),
            ords: Arc::new(ords),
        })
    }

    pub fn segments(&self) -> usize {
        self.searcher.segment_readers().len()
    }

    fn query(&self, qt: &[String], last_prefix: bool) -> Box<dyn TQuery> {
        let term = |field: Field, t: &str| -> Box<dyn TQuery> {
            Box::new(TermQuery::new(
                Term::from_field_text(field, t),
                IndexRecordOption::Basic,
            ))
        };
        let name_q = |i: usize, t: &str| {
            if last_prefix && i == qt.len() - 1 {
                term(self.f.name_pre, char_prefix(t, MAX_PREFIX).unwrap_or(t))
            } else {
                term(self.f.name_tok, t)
            }
        };
        if qt.len() == 1 {
            return name_q(0, &qt[0]);
        }
        let mut must: Vec<(Occur, Box<dyn TQuery>)> = qt
            .iter()
            .enumerate()
            .map(|(i, t)| {
                let either: Box<dyn TQuery> = Box::new(BooleanQuery::new(vec![
                    (Occur::Should, name_q(i, t)),
                    (Occur::Should, term(self.f.ctx_tok, t)),
                ]));
                (Occur::Must, either)
            })
            .collect();
        let any_in_name: Vec<_> = qt
            .iter()
            .enumerate()
            .map(|(i, t)| (Occur::Should, name_q(i, t)))
            .collect();
        must.push((Occur::Must, Box::new(BooleanQuery::new(any_in_name))));
        Box::new(BooleanQuery::new(must))
    }

    #[allow(clippy::cast_possible_truncation)]
    pub fn search(&self, q: &Query<'_>) -> Vec<Hit> {
        let mut qt = tokens(q.text);
        qt.truncate(6);
        if qt.is_empty() {
            return Vec::new();
        }
        let last_prefix = !q.text.ends_with(char::is_whitespace);
        let searcher = &self.searcher;
        let query = self.query(&qt, last_prefix);
        let top = if self.sorted {
            self.sorted_candidates(searcher, query, q.focus)
        } else {
            self.scored_candidates(searcher, &*query, q.focus)
        };
        self.rerank(searcher, top, &qt, last_prefix, q.limit)
    }

    /// Unsorted index: score every match by importance + kind + distance.
    fn scored_candidates(
        &self,
        searcher: &tantivy::Searcher,
        query: &dyn TQuery,
        focus: Option<(f64, f64)>,
    ) -> Vec<(f32, DocAddress)> {
        let (kinds, cols, ords) = (self.kinds.clone(), self.cols.clone(), self.ords.clone());
        let collector = TopDocs::with_limit(RERANK).tweak_score(move |seg: &SegmentReader| {
            let ord = ords[&seg.segment_id()];
            let (kinds, cols) = (kinds.clone(), cols.clone());
            move |doc: DocId, _: Score| cols[ord].static_score(doc, &kinds, focus)
        });
        searcher.search(query, &collector).unwrap_or_default()
    }

    /// Sorted index: doc order is rank order, so take the first matches
    /// globally and near the user, then keep the best [`RERANK`] by
    /// importance + kind + distance.
    #[allow(clippy::cast_possible_truncation)]
    fn sorted_candidates(
        &self,
        searcher: &tantivy::Searcher,
        query: Box<dyn TQuery>,
        focus: Option<(f64, f64)>,
    ) -> Vec<(f32, DocAddress)> {
        let mut queries: Vec<(Box<dyn TQuery>, usize)> = Vec::new();
        if let Some((lat, lon)) = focus {
            let mut cells: Vec<u16> = [-1.9, 0.0, 1.9]
                .iter()
                .flat_map(|dy| [-1.9, 0.0, 1.9].map(|dx| cell(lat + dy, lon + dx)))
                .collect();
            cells.sort_unstable();
            cells.dedup();
            let near: Vec<(Occur, Box<dyn TQuery>)> = cells
                .into_iter()
                .map(|c| {
                    let t: Box<dyn TQuery> = Box::new(TermQuery::new(
                        Term::from_field_u64(self.f.cell, u64::from(c)),
                        IndexRecordOption::Basic,
                    ));
                    (Occur::Should, t)
                })
                .collect();
            let local: Box<dyn TQuery> = Box::new(BooleanQuery::new(vec![
                (Occur::Must, query.box_clone()),
                (Occur::Must, Box::new(BooleanQuery::new(near))),
            ]));
            queries.push((local, LOCAL_TAKE));
        }
        queries.push((query, GLOBAL_TAKE));

        let mut out: Vec<(f32, DocAddress)> = Vec::new();
        let mut seen = HashSet::new();
        for (seg_ord, seg) in searcher.segment_readers().iter().enumerate() {
            let cols = &self.cols[seg_ord];
            for (q, take) in &queries {
                let Ok(weight) = q.weight(EnableScoring::disabled_from_searcher(searcher)) else {
                    continue;
                };
                let Ok(mut docs) = weight.scorer(seg, 1.0) else {
                    continue;
                };
                let mut doc = docs.doc();
                let mut n = 0;
                while doc != TERMINATED && n < *take {
                    if seen.insert((seg_ord, doc)) {
                        let s = cols.static_score(doc, &self.kinds, focus);
                        out.push((s, DocAddress::new(seg_ord as u32, doc)));
                    }
                    n += 1;
                    doc = docs.advance();
                }
            }
        }
        out.sort_by(|a, b| b.0.total_cmp(&a.0));
        out.truncate(RERANK);
        out
    }

    /// Fetch stored fields for the candidates and apply the shared text
    /// scoring, exactly as the custom engine does.
    fn rerank(
        &self,
        searcher: &tantivy::Searcher,
        top: Vec<(f32, DocAddress)>,
        qt: &[String],
        last_prefix: bool,
        limit: usize,
    ) -> Vec<Hit> {
        let text = |d: &TantivyDocument, f: Field| -> String {
            d.get_first(f)
                .and_then(|v| v.as_str())
                .unwrap_or_default()
                .to_owned()
        };
        let mut hits: Vec<Hit> = top
            .into_iter()
            .filter_map(|(static_part, addr)| {
                let d: TantivyDocument = searcher.doc(addr).ok()?;
                let names = text(&d, self.f.names_norm);
                let ctx = text(&d, self.f.ctx_norm);
                let t = text_score(names.split('|'), &ctx, qt, last_prefix)?;
                let bbox = d
                    .get_first(self.f.bbox)
                    .and_then(|v| v.as_str())
                    .and_then(|s| {
                        let v: Vec<f32> = s.split(',').filter_map(|x| x.parse().ok()).collect();
                        v.try_into().ok()
                    });
                let cols = &self.cols[addr.segment_ord as usize];
                let doc = addr.doc_id;
                Some(Hit {
                    name: text(&d, self.f.name),
                    context: text(&d, self.f.context),
                    kind: self.kinds[cols.kind.get_val(doc) as usize].clone(),
                    lat: cols.lat.get_val(doc) as f32,
                    lon: cols.lon.get_val(doc) as f32,
                    bbox,
                    osm: text(&d, self.f.osm),
                    score: t + static_part,
                    doc: u32::MAX,
                })
            })
            .collect();
        hits.sort_by(|a, b| b.score.total_cmp(&a.score));
        let mut seen = HashSet::new();
        hits.retain(|h| seen.insert((h.name.clone(), h.context.clone(), h.kind.clone())));
        hits.truncate(limit);
        hits
    }
}

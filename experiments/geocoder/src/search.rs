//! Query evaluation over the memory-mapped index.
//!
//! A query is split into tokens. The leading tokens must match a place's
//! name; trailing tokens may instead match its context ("paris texas"). The
//! last token is a prefix while the user is still typing. Candidates come out
//! of the posting lists best-first, are scored by importance and distance to
//! the caller, and the best few hundred are reranked on how well the name
//! matches.

use std::borrow::Cow;
use std::cmp::Reverse;
use std::collections::BinaryHeap;

use fst::automaton::{Automaton, Levenshtein, Str};
use fst::{IntoStreamer, Streamer};

use crate::index::{Index, NS_CONTEXT, NS_PREFIX, NS_TERM, PREFIX_CHARS};
use crate::normalize::{folded, tokens};

const MAX_TOKENS: usize = 6;
/// Most documents scored for one query.
const SCAN_CAP: usize = 3_000_000;
/// Most terms unioned for one prefix or fuzzy token.
const EXPANSION_CAP: usize = 20_000;
const FUZZY_PENALTY: f32 = 0.2;
/// Typo-tolerant matching only runs when exact matching found fewer hits
/// than this.
const FUZZY_BELOW: usize = 1;

pub struct Query<'a> {
    pub text: &'a str,
    /// `(latitude, longitude)` to bias results towards.
    pub near: Option<(f64, f64)>,
    pub limit: usize,
}

#[derive(Debug, Clone)]
pub struct Hit {
    pub doc: u32,
    pub score: f32,
    pub distance_km: Option<f32>,
}

struct Scored {
    score: f32,
    doc: u32,
}
impl PartialEq for Scored {
    fn eq(&self, o: &Self) -> bool {
        self.score == o.score && self.doc == o.doc
    }
}
impl Eq for Scored {}
impl PartialOrd for Scored {
    fn partial_cmp(&self, o: &Self) -> Option<std::cmp::Ordering> {
        Some(self.cmp(o))
    }
}
impl Ord for Scored {
    fn cmp(&self, o: &Self) -> std::cmp::Ordering {
        self.score.total_cmp(&o.score).then(o.doc.cmp(&self.doc))
    }
}

fn distance_km(lat1: f64, lon1: f64, lat2: f64, lon2: f64) -> f32 {
    let (p1, p2) = (lat1.to_radians(), lat2.to_radians());
    let dp = p2 - p1;
    let dl = (lon2 - lon1).to_radians();
    let a = (dp / 2.0).sin().powi(2) + p1.cos() * p2.cos() * (dl / 2.0).sin().powi(2);
    (6371.0 * 2.0 * a.sqrt().asin()) as f32
}

/// How much being `km` away from the caller is worth. A strong pull within
/// a day's ride and a weak one across the region.
fn proximity(km: f32) -> f32 {
    0.45 * (-km / 75.0).exp() + 0.15 * (-km / 1500.0).exp()
}
const MAX_PROXIMITY: f32 = 0.6;

fn key(namespace: u8, term: &str) -> Vec<u8> {
    let mut k = Vec::with_capacity(term.len() + 1);
    k.push(namespace);
    k.extend_from_slice(term.as_bytes());
    k
}

fn union<'a>(index: &'a Index, lists: Vec<u64>) -> Cow<'a, [u32]> {
    match lists.len() {
        0 => Cow::Borrowed(&[]),
        1 => Cow::Borrowed(index.postings(lists[0])),
        _ => {
            let mut merged = Vec::new();
            for l in lists {
                merged.extend_from_slice(index.postings(l));
            }
            merged.sort_unstable();
            merged.dedup();
            Cow::Owned(merged)
        }
    }
}

fn collect<A: Automaton>(index: &Index, automaton: A) -> Vec<u64> {
    let mut stream = index.terms.search(automaton).into_stream();
    let mut lists = Vec::new();
    while let Some((_, list)) = stream.next() {
        lists.push(list);
        if lists.len() >= EXPANSION_CAP {
            break;
        }
    }
    lists.sort_unstable();
    lists.dedup();
    lists
}

/// The ids matching one query token in `namespace`.
fn resolve<'a>(
    index: &'a Index,
    namespace: u8,
    token: &str,
    prefix: bool,
    fuzzy: bool,
) -> Cow<'a, [u32]> {
    let chars = token.chars().count();
    if fuzzy && chars >= 3 {
        // Two edits only for long, complete words: with a prefix the
        // automaton would accept a large slice of the dictionary.
        let distance = if chars >= 9 && !prefix { 2 } else { 1 };
        let Ok(lev) = Levenshtein::new(token, distance) else {
            return Cow::Borrowed(&[]);
        };
        // The automaton runs after the namespace byte has been consumed.
        let ns = [namespace];
        let ns = Str::new(std::str::from_utf8(&ns).unwrap_or("t"));
        let mut lists = if prefix {
            collect(index, StartsWithThen(ns, lev.starts_with()))
        } else {
            collect(index, StartsWithThen(ns, lev))
        };
        // Swapped neighbours ("adnorra") count as two edits to Levenshtein,
        // but are the most common slip, so try each swap as well.
        let letters: Vec<char> = token.chars().collect();
        for i in 0..letters.len() - 1 {
            if letters[i] == letters[i + 1] {
                continue;
            }
            let mut swapped = letters.clone();
            swapped.swap(i, i + 1);
            let swapped: String = swapped.into_iter().collect();
            let k = key(namespace, &swapped);
            if prefix {
                lists.extend(collect(
                    index,
                    Str::new(std::str::from_utf8(&k).unwrap_or("")).starts_with(),
                ));
            } else if let Some(list) = index.terms.get(&k) {
                lists.push(list);
            }
        }
        lists.sort_unstable();
        lists.dedup();
        return union(index, lists);
    }
    if !prefix {
        return Cow::Borrowed(index.lookup(namespace, token).unwrap_or(&[]));
    }
    if namespace == NS_TERM && chars <= PREFIX_CHARS {
        return Cow::Borrowed(index.lookup(NS_PREFIX, token).unwrap_or(&[]));
    }
    let k = key(namespace, token);
    let lists = collect(
        index,
        Str::new(std::str::from_utf8(&k).unwrap_or("")).starts_with(),
    );
    union(index, lists)
}

/// Matches `first` exactly, then hands the rest of the key to `rest`.
struct StartsWithThen<'a, A>(Str<'a>, A);

impl<A: Automaton> Automaton for StartsWithThen<'_, A> {
    type State = (Option<<Str<'static> as Automaton>::State>, Option<A::State>);

    fn start(&self) -> Self::State {
        (Some(self.0.start()), None)
    }
    fn is_match(&self, state: &Self::State) -> bool {
        state.1.as_ref().is_some_and(|s| self.1.is_match(s))
    }
    fn can_match(&self, state: &Self::State) -> bool {
        match state {
            (_, Some(s)) => self.1.can_match(s),
            (Some(s), None) => self.0.can_match(s),
            (None, None) => false,
        }
    }
    fn accept(&self, state: &Self::State, byte: u8) -> Self::State {
        match state {
            (_, Some(s)) => (None, Some(self.1.accept(s, byte))),
            (Some(s), None) => {
                let next = self.0.accept(s, byte);
                if self.0.is_match(&next) {
                    (None, Some(self.1.start()))
                } else if self.0.can_match(&next) {
                    (Some(next), None)
                } else {
                    (None, None)
                }
            }
            (None, None) => (None, None),
        }
    }
}

fn intersect<'a>(lists: &[&'a [u32]]) -> Cow<'a, [u32]> {
    let mut lists: Vec<&[u32]> = lists.to_vec();
    lists.sort_by_key(|l| l.len());
    let Some((&first, rest)) = lists.split_first() else {
        return Cow::Borrowed(&[]);
    };
    if rest.is_empty() {
        return Cow::Borrowed(first);
    }
    let mut cursors = vec![0usize; rest.len()];
    let mut out = Vec::new();
    'doc: for &doc in first {
        for (list, cursor) in rest.iter().zip(cursors.iter_mut()) {
            // Gallop forward from the last position.
            let mut step = 1;
            let mut hi = *cursor;
            while hi < list.len() && list[hi] < doc {
                *cursor = hi + 1;
                hi += step;
                step *= 2;
            }
            let hi = hi.min(list.len());
            *cursor += list[*cursor..hi].partition_point(|&d| d < doc);
            if *cursor >= list.len() {
                break 'doc;
            }
            if list[*cursor] != doc {
                continue 'doc;
            }
        }
        out.push(doc);
    }
    Cow::Owned(out)
}

/// One pass over the ways of splitting the query into name and context.
fn candidates(
    index: &Index,
    toks: &[String],
    last_is_prefix: bool,
    fuzzy: bool,
    near: Option<(f64, f64)>,
    want: usize,
    penalty: f32,
    heap: &mut BinaryHeap<Reverse<Scored>>,
) {
    let n = toks.len();
    let (lat, lon, imp, ctx) = (
        index.lat(),
        index.lon(),
        index.importance(),
        index.context(),
    );
    // Resolve every token once; the splits below reuse the lists.
    let mut name_lists: Vec<Cow<[u32]>> = (0..n)
        .map(|i| {
            resolve(
                index,
                NS_TERM,
                &toks[i],
                last_is_prefix && i == n - 1,
                false,
            )
        })
        .collect();
    if fuzzy {
        // Words that are in the dictionary are taken as typed; only the ones
        // that match nothing are assumed to be misspelt. If every word
        // exists but no place has them all, any of them may be wrong.
        let unknown: Vec<bool> = name_lists.iter().map(|l| l.is_empty()).collect();
        let any_unknown = unknown.iter().any(|&u| u);
        for i in 0..n {
            if unknown[i] || !any_unknown {
                let exact = std::mem::take(&mut name_lists[i]);
                let loose = resolve(index, NS_TERM, &toks[i], last_is_prefix && i == n - 1, true);
                name_lists[i] = if loose.is_empty() { exact } else { loose };
            }
        }
    }
    let ctx_lists: Vec<Cow<[u32]>> = (0..n)
        .map(|i| {
            if i == 0 {
                Cow::Borrowed(&[][..])
            } else {
                resolve(
                    index,
                    NS_CONTEXT,
                    &toks[i],
                    last_is_prefix && i == n - 1,
                    false,
                )
            }
        })
        .collect();
    for name_len in (1..=n).rev() {
        if name_lists[..name_len].iter().any(|l| l.is_empty()) {
            continue;
        }
        let allowed: Option<Vec<u64>> = if name_len < n {
            let lists: Vec<&[u32]> = ctx_lists[name_len..].iter().map(AsRef::as_ref).collect();
            let ids = intersect(&lists);
            if ids.is_empty() {
                continue;
            }
            let mut bits = vec![0u64; index.meta.contexts as usize / 64 + 1];
            for &id in ids.iter() {
                bits[id as usize / 64] |= 1 << (id % 64);
            }
            Some(bits)
        } else {
            None
        };

        let lists: Vec<&[u32]> = name_lists[..name_len].iter().map(AsRef::as_ref).collect();
        let docs = intersect(&lists);
        let mut found = 0;
        for &doc in docs.iter().take(SCAN_CAP) {
            let d = doc as usize;
            if let Some(bits) = &allowed {
                let c = ctx[d];
                if bits[c as usize / 64] & (1 << (c % 64)) == 0 {
                    continue;
                }
            }
            let base = f32::from(imp[d]) / 65535.0 - penalty;
            let full = heap.len() >= want;
            let floor = heap.peek().map_or(f32::MIN, |s| s.0.score);
            let score = match near {
                None => base,
                Some((qlat, qlon)) => {
                    // Lists are best-first, so once even a place next door
                    // couldn't make the cut, nothing later can.
                    if full && base + MAX_PROXIMITY <= floor {
                        break;
                    }
                    let km =
                        distance_km(qlat, qlon, f64::from(lat[d]) / 1e7, f64::from(lon[d]) / 1e7);
                    base + proximity(km)
                }
            };
            if !full {
                heap.push(Reverse(Scored { score, doc }));
            } else if score > floor {
                heap.pop();
                heap.push(Reverse(Scored { score, doc }));
            } else if near.is_none() {
                break;
            }
            found += 1;
        }
        // A full-name match is what the user most likely meant; only fall
        // back to reading trailing words as context when it found little.
        if found >= want.min(20) {
            break;
        }
    }
}

#[must_use]
pub fn search(index: &Index, query: &Query) -> Vec<Hit> {
    let mut toks = tokens(query.text);
    toks.truncate(MAX_TOKENS);
    if toks.is_empty() {
        return Vec::new();
    }
    let last_is_prefix = !query.text.ends_with(char::is_whitespace);
    let want = (query.limit * 30).max(200);

    let mut heap = BinaryHeap::new();
    candidates(
        index,
        &toks,
        last_is_prefix,
        false,
        query.near,
        want,
        0.0,
        &mut heap,
    );
    if heap.len() < FUZZY_BELOW {
        candidates(
            index,
            &toks,
            last_is_prefix,
            true,
            query.near,
            want,
            FUZZY_PENALTY,
            &mut heap,
        );
    }

    // Rerank on how well the name itself matches what was typed.
    let typed = toks.join(" ");
    let mut best: std::collections::HashMap<u32, f32> = std::collections::HashMap::new();
    for Reverse(s) in heap {
        let e = best.entry(s.doc).or_insert(s.score);
        *e = e.max(s.score);
    }
    let mut ranked: Vec<(f32, u32, String)> = Vec::with_capacity(best.len());
    for (doc, score) in best {
        let s = Scored { score, doc };
        let (local, en) = index.names(s.doc);
        let local_f = folded(local);
        let mut bonus = name_bonus(&local_f, &typed);
        if let Some(en) = en {
            bonus = bonus.max(name_bonus(&folded(en), &typed));
        }
        ranked.push((s.score + bonus, s.doc, local_f));
    }
    ranked.sort_by(|a, b| b.0.total_cmp(&a.0).then(a.1.cmp(&b.1)));

    // The same place is often mapped twice (a node and its boundary).
    let (lat, lon) = (index.lat(), index.lon());
    let mut hits: Vec<Hit> = Vec::with_capacity(query.limit);
    let mut kept: Vec<(u32, &str)> = Vec::new();
    for (score, doc, name) in &ranked {
        let (dlat, dlon) = (
            f64::from(lat[*doc as usize]) / 1e7,
            f64::from(lon[*doc as usize]) / 1e7,
        );
        let duplicate = kept.iter().any(|(other, other_name)| {
            other_name == name
                && distance_km(
                    dlat,
                    dlon,
                    f64::from(lat[*other as usize]) / 1e7,
                    f64::from(lon[*other as usize]) / 1e7,
                ) < 20.0
        });
        if duplicate {
            continue;
        }
        kept.push((*doc, name));
        hits.push(Hit {
            doc: *doc,
            score: *score,
            distance_km: query
                .near
                .map(|(qlat, qlon)| distance_km(qlat, qlon, dlat, dlon)),
        });
        if hits.len() == query.limit {
            break;
        }
    }
    hits
}

fn name_bonus(name: &str, typed: &str) -> f32 {
    if name == typed {
        0.3
    } else if name.starts_with(typed) {
        0.15
    } else {
        0.0
    }
}

//! The on-disk index: one file of 8-byte-aligned sections followed by a JSON
//! footer naming them. The server memory-maps it and reads columns in place,
//! so resident memory is whatever pages queries actually touch.
//!
//! Documents are numbered by descending importance. Every posting list is a
//! sorted `u32` array, so it is also sorted best-first.

use std::collections::BTreeMap;
use std::fs::File;
use std::io::{BufWriter, Seek, Write};
use std::path::Path;

use anyhow::{Context, bail};
use memmap2::Mmap;
use serde::{Deserialize, Serialize};

pub const MAGIC: &[u8; 8] = b"ATGEO001";

/// Prefixes of up to this many chars get their own precomputed posting list.
pub const PREFIX_CHARS: usize = 4;
/// Posting lists for 1- and 2-char prefixes keep only the best documents.
pub const SHORT_PREFIX_CAP: usize = 200_000;

pub const NS_TERM: u8 = b't';
pub const NS_PREFIX: u8 = b'p';
pub const NS_CONTEXT: u8 = b'c';

#[derive(Serialize, Deserialize, Default)]
pub struct Meta {
    pub docs: u32,
    pub contexts: u32,
    pub kinds: Vec<String>,
    pub built_from: String,
    pub sections: BTreeMap<String, (u64, u64)>,
}

pub struct Writer {
    out: BufWriter<File>,
    pos: u64,
    meta: Meta,
}

impl Writer {
    pub fn create(path: &Path) -> anyhow::Result<Self> {
        Ok(Self {
            out: BufWriter::with_capacity(1 << 22, File::create(path)?),
            pos: 0,
            meta: Meta::default(),
        })
    }

    pub fn meta(&mut self) -> &mut Meta {
        &mut self.meta
    }

    pub fn section(&mut self, name: &str, bytes: &[u8]) -> anyhow::Result<()> {
        self.begin(name)?;
        self.append(bytes)?;
        self.end(name);
        Ok(())
    }

    pub fn begin(&mut self, name: &str) -> anyhow::Result<()> {
        let pad = (8 - self.pos % 8) % 8;
        self.out.write_all(&[0u8; 8][..pad as usize])?;
        self.pos += pad;
        self.meta.sections.insert(name.to_string(), (self.pos, 0));
        Ok(())
    }

    pub fn append(&mut self, bytes: &[u8]) -> anyhow::Result<()> {
        self.out.write_all(bytes)?;
        self.pos += bytes.len() as u64;
        Ok(())
    }

    pub fn end(&mut self, name: &str) {
        let entry = self.meta.sections.get_mut(name).expect("section begun");
        entry.1 = self.pos - entry.0;
    }

    pub fn finish(mut self) -> anyhow::Result<u64> {
        let meta = serde_json::to_vec(&self.meta)?;
        self.out.write_all(&meta)?;
        self.out.write_all(&(meta.len() as u64).to_le_bytes())?;
        self.out.write_all(MAGIC)?;
        self.out.flush()?;
        Ok(self.out.get_mut().stream_position()?)
    }
}

pub fn as_bytes<T: Copy>(values: &[T]) -> &[u8] {
    // SAFETY: only used with plain integer and float types, which have no
    // padding and are valid as bytes.
    unsafe { std::slice::from_raw_parts(values.as_ptr().cast(), std::mem::size_of_val(values)) }
}

pub struct Index {
    map: Mmap,
    pub meta: Meta,
    pub terms: fst::Map<&'static [u8]>,
}

macro_rules! column {
    ($name:ident, $ty:ty) => {
        #[must_use]
        pub fn $name(&self) -> &[$ty] {
            self.cast(stringify!($name))
        }
    };
}

impl Index {
    pub fn open(path: &Path) -> anyhow::Result<Self> {
        let file = File::open(path).with_context(|| format!("opening {}", path.display()))?;
        // SAFETY: the file is opened read-only and replaced atomically (new
        // file, new process), never modified in place.
        let map = unsafe { Mmap::map(&file)? };
        let len = map.len();
        if len < 16 || &map[len - 8..] != MAGIC {
            bail!("not a geocoder index");
        }
        let meta_len = u64::from_le_bytes(map[len - 16..len - 8].try_into()?) as usize;
        let meta: Meta = serde_json::from_slice(&map[len - 16 - meta_len..len - 16])?;
        let (off, flen) = *meta.sections.get("fst").context("no fst section")?;
        // SAFETY: the slice borrows from `map`, which lives as long as `Index`
        // and is never moved out of it.
        let fst_bytes: &'static [u8] =
            unsafe { std::slice::from_raw_parts(map.as_ptr().add(off as usize), flen as usize) };
        let terms = fst::Map::new(fst_bytes)?;
        Ok(Self { map, meta, terms })
    }

    fn bytes(&self, name: &str) -> &[u8] {
        let (off, len) = self.meta.sections[name];
        &self.map[off as usize..(off + len) as usize]
    }

    fn cast<T: Copy>(&self, name: &str) -> &[T] {
        let bytes = self.bytes(name);
        // SAFETY: sections are written 8-byte aligned from slices of `T`, and
        // every `T` used is a plain integer or float.
        let (head, body, _) = unsafe { bytes.align_to::<T>() };
        assert!(head.is_empty(), "section {name} is misaligned");
        body
    }

    column!(lat, i32);
    column!(lon, i32);
    column!(importance, u16);
    column!(kind, u8);
    column!(country, [u8; 2]);
    column!(context, u32);
    column!(osm, u64);
    column!(bbox, [f32; 4]);
    column!(name_off, u64);
    column!(ctx_off, u64);
    column!(post_off, u64);
    column!(post, u32);

    /// Display names of a document: the local name, then the English one if
    /// it differs.
    #[must_use]
    pub fn names(&self, doc: u32) -> (&str, Option<&str>) {
        let off = self.name_off();
        let raw = &self.bytes("names")[off[doc as usize] as usize..off[doc as usize + 1] as usize];
        let raw = std::str::from_utf8(raw).unwrap_or("");
        match raw.split_once('\x1f') {
            Some((local, en)) => (local, Some(en)),
            None => (raw, None),
        }
    }

    #[must_use]
    pub fn context_label(&self, ctx: u32) -> &str {
        let off = self.ctx_off();
        let raw =
            &self.bytes("ctx_names")[off[ctx as usize] as usize..off[ctx as usize + 1] as usize];
        std::str::from_utf8(raw).unwrap_or("")
    }

    #[must_use]
    pub fn postings(&self, list: u64) -> &[u32] {
        let off = self.post_off();
        &self.post()[off[list as usize] as usize..off[list as usize + 1] as usize]
    }

    #[must_use]
    pub fn lookup(&self, namespace: u8, term: &str) -> Option<&[u32]> {
        let mut key = Vec::with_capacity(term.len() + 1);
        key.push(namespace);
        key.extend_from_slice(term.as_bytes());
        self.terms.get(&key).map(|list| self.postings(list))
    }
}

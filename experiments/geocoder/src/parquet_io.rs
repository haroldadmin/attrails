//! Parquet as the hand-off between `filter` and the index builders.
//!
//! One row per place. Strings are dictionary-encoded and zstd-compressed by
//! Parquet, so repetitive columns like `kind`, `state` and `cc` cost almost
//! nothing. English country names travel in the file's key-value metadata
//! under `countries`.
//!
//! A side benefit: the file is queryable with DuckDB, e.g.
//! `SELECT kind, count(*) FROM 'planet.parquet' GROUP BY 1 ORDER BY 2 DESC`.

use std::collections::{BTreeMap, HashMap};
use std::fs::File;
use std::path::Path;
use std::sync::Arc;

use anyhow::{Context, Result};
use arrow_array::builder::{Float32Builder, Float64Builder, ListBuilder, StringBuilder};
use arrow_array::cast::AsArray;
use arrow_array::types::{Float32Type, Float64Type};
use arrow_array::{Array, ArrayRef, RecordBatch};
use arrow_schema::{DataType, Field, Schema, SchemaRef};
use parquet::arrow::ArrowWriter;
use parquet::arrow::arrow_reader::ParquetRecordBatchReaderBuilder;
use parquet::basic::{Compression, ZstdLevel};
use parquet::file::metadata::KeyValue;
use parquet::file::properties::WriterProperties;

use crate::filter::{Item, Record};

const BATCH_ROWS: usize = 64 * 1024;

fn list_of_strings() -> DataType {
    DataType::List(Arc::new(Field::new("item", DataType::Utf8, true)))
}

fn schema() -> SchemaRef {
    let s = |name: &str, nullable: bool| Field::new(name, DataType::Utf8, nullable);
    Arc::new(Schema::new(vec![
        s("osm", false),
        s("kind", false),
        s("name", false),
        Field::new("names", list_of_strings(), false),
        s("city", true),
        s("county", true),
        s("state", true),
        s("cc", true),
        Field::new("context_alt", list_of_strings(), false),
        Field::new("importance", DataType::Float32, false),
        Field::new("lon", DataType::Float64, false),
        Field::new("lat", DataType::Float64, false),
        Field::new("bbox_min_lon", DataType::Float32, true),
        Field::new("bbox_min_lat", DataType::Float32, true),
        Field::new("bbox_max_lon", DataType::Float32, true),
        Field::new("bbox_max_lat", DataType::Float32, true),
    ]))
}

/// Streams records into a Parquet file in row groups of [`BATCH_ROWS`].
pub struct Writer {
    writer: ArrowWriter<File>,
    rows: Vec<Record>,
    countries: BTreeMap<String, String>,
}

impl Writer {
    pub fn create(path: &Path) -> Result<Self> {
        let props = WriterProperties::builder()
            .set_compression(Compression::ZSTD(ZstdLevel::try_new(6)?))
            .build();
        let file = File::create(path).with_context(|| format!("creating {}", path.display()))?;
        Ok(Self {
            writer: ArrowWriter::try_new(file, schema(), Some(props))?,
            rows: Vec::with_capacity(BATCH_ROWS),
            countries: BTreeMap::new(),
        })
    }

    pub fn push(&mut self, item: Item) -> Result<()> {
        match item {
            Item::Countries { names } => self.countries.extend(names),
            Item::Place(r) => {
                self.rows.push(r);
                if self.rows.len() >= BATCH_ROWS {
                    self.flush()?;
                }
            }
        }
        Ok(())
    }

    fn flush(&mut self) -> Result<()> {
        if self.rows.is_empty() {
            return Ok(());
        }
        let rows = std::mem::take(&mut self.rows);
        let strs = |f: &dyn Fn(&Record) -> Option<&str>| -> ArrayRef {
            let mut b = StringBuilder::new();
            for r in &rows {
                b.append_option(f(r));
            }
            Arc::new(b.finish())
        };
        let lists = |f: &dyn Fn(&Record) -> &Vec<String>| -> ArrayRef {
            let mut b = ListBuilder::new(StringBuilder::new());
            for r in &rows {
                for v in f(r) {
                    b.values().append_value(v);
                }
                b.append(true);
            }
            Arc::new(b.finish())
        };
        let bbox = |i: usize| -> ArrayRef {
            let mut b = Float32Builder::new();
            for r in &rows {
                b.append_option(r.bbox.map(|bb| bb[i]));
            }
            Arc::new(b.finish())
        };
        let mut imp = Float32Builder::new();
        let mut lon = Float64Builder::new();
        let mut lat = Float64Builder::new();
        for r in &rows {
            imp.append_value(r.importance);
            lon.append_value(r.lon);
            lat.append_value(r.lat);
        }
        let columns: Vec<ArrayRef> = vec![
            strs(&|r| Some(&r.osm)),
            strs(&|r| Some(&r.kind)),
            strs(&|r| Some(&r.name)),
            lists(&|r| &r.names),
            strs(&|r| r.city.as_deref()),
            strs(&|r| r.county.as_deref()),
            strs(&|r| r.state.as_deref()),
            strs(&|r| r.cc.as_deref()),
            lists(&|r| &r.context_alt),
            Arc::new(imp.finish()),
            Arc::new(lon.finish()),
            Arc::new(lat.finish()),
            bbox(0),
            bbox(1),
            bbox(2),
            bbox(3),
        ];
        self.writer
            .write(&RecordBatch::try_new(schema(), columns)?)?;
        Ok(())
    }

    pub fn finish(mut self) -> Result<()> {
        self.flush()?;
        self.writer.append_key_value_metadata(KeyValue::new(
            "countries".to_owned(),
            serde_json::to_string(&self.countries)?,
        ));
        self.writer.close()?;
        Ok(())
    }
}

fn opt(a: &arrow_array::StringArray, i: usize) -> Option<String> {
    a.is_valid(i).then(|| a.value(i).to_owned())
}

fn list(a: &arrow_array::ListArray, i: usize) -> Vec<String> {
    let v = a.value(i);
    let v = v.as_string::<i32>();
    (0..v.len()).map(|j| v.value(j).to_owned()).collect()
}

/// Reads every record and the country names from a Parquet file.
pub fn read(path: &Path) -> Result<(Vec<Record>, HashMap<String, String>)> {
    let file = File::open(path).with_context(|| format!("opening {}", path.display()))?;
    let builder = ParquetRecordBatchReaderBuilder::try_new(file)?;
    let countries = builder
        .metadata()
        .file_metadata()
        .key_value_metadata()
        .and_then(|kv| kv.iter().find(|k| k.key == "countries"))
        .and_then(|k| k.value.as_deref())
        .map(serde_json::from_str)
        .transpose()?
        .unwrap_or_default();
    let mut out = Vec::new();
    for batch in builder.with_batch_size(BATCH_ROWS).build()? {
        let b = batch?;
        let s = |i: usize| b.column(i).as_string::<i32>();
        let l = |i: usize| b.column(i).as_list::<i32>();
        let f32s = |i: usize| b.column(i).as_primitive::<Float32Type>();
        let f64s = |i: usize| b.column(i).as_primitive::<Float64Type>();
        for i in 0..b.num_rows() {
            let bbox = f32s(12)
                .is_valid(i)
                .then(|| [12, 13, 14, 15].map(|c| f32s(c).value(i)));
            out.push(Record {
                osm: s(0).value(i).to_owned(),
                kind: s(1).value(i).to_owned(),
                name: s(2).value(i).to_owned(),
                names: list(l(3), i),
                city: opt(s(4), i),
                county: opt(s(5), i),
                state: opt(s(6), i),
                cc: opt(s(7), i),
                context_alt: list(l(8), i),
                importance: f32s(9).value(i),
                lon: f64s(10).value(i),
                lat: f64s(11).value(i),
                bbox,
            });
        }
    }
    Ok((out, countries))
}

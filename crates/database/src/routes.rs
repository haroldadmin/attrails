use jiff::Timestamp;
use serde_json::Value;

/// A row to insert or update in the `routes` table, built from an
/// `app.attrails.v0.route` record.
#[derive(Debug, Clone)]
pub struct NewRoute {
    pub uri: String,
    pub cid: String,
    pub did: String,
    pub rkey: String,
    pub name: String,
    pub description: Option<String>,
    pub activity: String,
    pub surface: Option<String>,
    pub difficulty: Option<String>,
    pub tags: Vec<String>,
    pub images: Value,
    pub details: Value,
    pub sort_at: Timestamp,
    pub created_at: Timestamp,
    pub ingested_at: Timestamp,
    pub gpx_cid: String,
}

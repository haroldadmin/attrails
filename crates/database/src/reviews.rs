use jiff::Timestamp;
use serde_json::Value;

/// A row to insert or update in the `reviews` table, built from an
/// `app.attrails.v0.review` record.
#[derive(Debug, Clone)]
pub struct NewReview {
    pub uri: String,
    pub cid: String,
    pub did: String,
    pub rkey: String,
    pub subject_uri: String,
    pub subject_cid: String,
    pub rating: i32,
    pub body: Option<String>,
    pub images: Value,
    pub sort_at: Timestamp,
    pub created_at: Timestamp,
    pub ingested_at: Timestamp,
}

use jiff::Timestamp;
use serde_json::Value;

/// A row to insert or update in the `users` table, built from an
/// `app.attrails.actor.profile` record.
#[derive(Debug, Clone)]
pub struct NewUser {
    pub uri: String,
    pub did: String,
    pub cid: String,
    pub name: String,
    pub bio: Option<String>,
    pub profile_picture_uri: Option<Value>,
    pub sort_at: Timestamp,
    pub created_at: Timestamp,
    pub ingested_at: Timestamp,
}

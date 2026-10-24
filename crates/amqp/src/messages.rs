use serde::{Deserialize, Serialize};

/// Payload for [`Queue::Blobs`](crate::Queue::Blobs): a request to parse a
/// route's GPX blob into a track.
///
/// `mime_type` and `size` are what the route record claims about the blob,
/// so obviously invalid blobs can be rejected without downloading them.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BlobMsg {
    pub did: String,
    pub cid: String,
    pub mime_type: String,
    pub size: usize,
}

/// Payload for [`Queue::Labels`](crate::Queue::Labels): a request to generate
/// labels for a record that needs to pass moderation.
#[derive(Debug, Serialize, Deserialize)]
pub struct LabelMsg {
    /// The `AtUri` of the record to label
    pub uri: String,
    /// The CID of the record to pin a specific version of it
    pub cid: String,
}

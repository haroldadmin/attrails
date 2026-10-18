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

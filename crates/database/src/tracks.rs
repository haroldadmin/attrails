use jiff::Timestamp;
use serde_json::Value;

/// A row to insert or update in the `tracks` table, built by parsing a
/// route's GPX blob.
///
/// Geography columns are `GeoJSON` geometries, converted to `PostGIS`
/// geography values when written.
#[derive(Debug, Clone)]
pub struct NewTrack {
    /// CID of the GPX blob this track was parsed from.
    pub cid: String,
    pub parser_version: i32,
    pub distance_m: f64,
    pub point_count: i32,
    pub elevation_gain_m: Option<f32>,
    pub elevation_loss_m: Option<f32>,
    pub min_elevation_m: Option<f32>,
    pub max_elevation_m: Option<f32>,
    pub duration_sec: Option<i32>,
    pub moving_time_sec: Option<i32>,
    pub is_loop: bool,
    /// `GeoJSON` `Point`.
    pub start_point: Value,
    /// `GeoJSON` `Point`.
    pub end_point: Value,
    /// `GeoJSON` `MultiLineString`.
    pub path: Option<Value>,
    /// JSON array of elevation samples.
    pub elevation_profile: Option<Value>,
    /// JSON array of waypoints.
    pub waypoints: Value,
    pub processed_at: Timestamp,
}

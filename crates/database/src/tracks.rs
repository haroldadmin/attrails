use anyhow::Result;
use jiff::Timestamp;
use jiff_sqlx::ToSqlx;
use serde_json::Value;
use sqlx::PgPool;

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

/// Whether the blob with the given CID has already been parsed into a track
/// by `parser_version` or a later version.
///
/// # Errors
///
/// Will return an `Err` if the query fails.
pub async fn track_exists(pool: &PgPool, cid: &str, parser_version: i32) -> Result<bool> {
    let exists = sqlx::query_scalar!(
        r#"
        SELECT EXISTS (
            SELECT 1 FROM tracks WHERE cid = $1 AND parser_version >= $2
        ) AS "exists!"
        "#,
        cid,
        parser_version,
    )
    .fetch_one(pool)
    .await?;

    Ok(exists)
}

/// Insert a track, or overwrite the existing row with the same CID.
///
/// A row written by a later parser version is never overwritten.
///
/// # Errors
///
/// Will return an `Err` if the query fails, including when a geography
/// column is not valid `GeoJSON`.
pub async fn upsert_track(pool: &PgPool, track: &NewTrack) -> Result<()> {
    sqlx::query!(
        r#"
        INSERT INTO tracks (
            cid, parser_version, distance_m, point_count, elevation_gain_m,
            elevation_loss_m, min_elevation_m, max_elevation_m, duration_sec,
            moving_time_sec, is_loop, start_point, end_point, path,
            elevation_profile, waypoints, processed_at
        )
        VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11,
            ST_SetSRID(ST_Force2D(ST_GeomFromGeoJSON($12::jsonb)), 4326)::geography,
            ST_SetSRID(ST_Force2D(ST_GeomFromGeoJSON($13::jsonb)), 4326)::geography,
            ST_SetSRID(ST_Force2D(ST_GeomFromGeoJSON($14::jsonb)), 4326)::geography,
            $15, $16, $17
        )
        ON CONFLICT (cid) DO UPDATE SET
            parser_version = excluded.parser_version,
            distance_m = excluded.distance_m,
            point_count = excluded.point_count,
            elevation_gain_m = excluded.elevation_gain_m,
            elevation_loss_m = excluded.elevation_loss_m,
            min_elevation_m = excluded.min_elevation_m,
            max_elevation_m = excluded.max_elevation_m,
            duration_sec = excluded.duration_sec,
            moving_time_sec = excluded.moving_time_sec,
            is_loop = excluded.is_loop,
            start_point = excluded.start_point,
            end_point = excluded.end_point,
            path = excluded.path,
            elevation_profile = excluded.elevation_profile,
            waypoints = excluded.waypoints,
            processed_at = excluded.processed_at
        WHERE tracks.parser_version <= excluded.parser_version
        "#,
        track.cid,
        track.parser_version,
        track.distance_m,
        track.point_count,
        track.elevation_gain_m,
        track.elevation_loss_m,
        track.min_elevation_m,
        track.max_elevation_m,
        track.duration_sec,
        track.moving_time_sec,
        track.is_loop,
        track.start_point,
        track.end_point,
        track.path,
        track.elevation_profile,
        track.waypoints,
        track.processed_at.to_sqlx(),
    )
    .execute(pool)
    .await?;

    Ok(())
}

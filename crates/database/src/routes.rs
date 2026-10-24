use anyhow::Result;
use jiff::Timestamp;
use jiff_sqlx::ToSqlx;
use serde_json::Value;
use sqlx::PgPool;

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

/// Insert a route, or overwrite the existing row with the same uri.
///
/// Clears any tombstone, so a re-created record becomes visible again.
///
/// # Errors
///
/// Will return an `Err` if the query fails.
pub async fn upsert_route(pool: &PgPool, route: &NewRoute) -> Result<()> {
    sqlx::query!(
        r#"
        INSERT INTO routes (
            uri, cid, did, rkey, name, description, activity, surface,
            difficulty, tags, images, details, sort_at, created_at,
            ingested_at, gpx_cid, tombstoned
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, FALSE)
        ON CONFLICT (uri) DO UPDATE SET
            cid = excluded.cid,
            did = excluded.did,
            rkey = excluded.rkey,
            name = excluded.name,
            description = excluded.description,
            activity = excluded.activity,
            surface = excluded.surface,
            difficulty = excluded.difficulty,
            tags = excluded.tags,
            images = excluded.images,
            details = excluded.details,
            sort_at = excluded.sort_at,
            created_at = excluded.created_at,
            ingested_at = excluded.ingested_at,
            gpx_cid = excluded.gpx_cid,
            tombstoned = FALSE
        "#,
        route.uri,
        route.cid,
        route.did,
        route.rkey,
        route.name,
        route.description,
        route.activity,
        route.surface,
        route.difficulty,
        &route.tags,
        route.images,
        route.details,
        route.sort_at.to_sqlx(),
        route.created_at.to_sqlx(),
        route.ingested_at.to_sqlx(),
        route.gpx_cid,
    )
    .execute(pool)
    .await?;

    Ok(())
}

/// Mark the route with the given uri as deleted.
///
/// # Errors
///
/// Will return an `Err` if the query fails.
pub async fn tombstone_route(pool: &PgPool, uri: &str) -> Result<()> {
    sqlx::query!("UPDATE routes SET tombstoned = TRUE WHERE uri = $1", uri)
        .execute(pool)
        .await?;

    Ok(())
}

pub struct RouteModerationView {
    pub uri: String,
    pub cid: String,
    pub name: String,
    pub description: Option<String>,
    pub tags: Vec<String>,
}

/// Fetches all the route information relevant for making
/// moderation decisions on it, or `None` if the route does not
/// exist or is tombstoned.
///
/// # Errors
///
/// Will return an `Err` if the query fails.
pub async fn fetch_route_moderation_view(
    pool: &PgPool,
    uri: &str,
) -> Result<Option<RouteModerationView>> {
    let route = sqlx::query_as!(
        RouteModerationView,
        r#"
            SELECT uri, cid, name, description, tags
            FROM routes
            WHERE uri = $1
              AND tombstoned = FALSE;
        "#,
        uri,
    )
    .fetch_optional(pool)
    .await?;

    Ok(route)
}

use anyhow::Result;
use jiff::Timestamp;
use jiff_sqlx::ToSqlx;
use serde_json::Value;
use sqlx::PgPool;

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

/// Insert a user, or overwrite the existing row with the same uri.
///
/// Clears any tombstone, so a re-created record becomes visible again.
///
/// # Errors
///
/// Will return an `Err` if the query fails.
pub async fn upsert_user(pool: &PgPool, user: &NewUser) -> Result<()> {
    sqlx::query!(
        r#"
        INSERT INTO users (
            uri, did, cid, name, bio, profile_picture_uri, sort_at,
            created_at, ingested_at, tombstoned
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, FALSE)
        ON CONFLICT (uri) DO UPDATE SET
            did = excluded.did,
            cid = excluded.cid,
            name = excluded.name,
            bio = excluded.bio,
            profile_picture_uri = excluded.profile_picture_uri,
            sort_at = excluded.sort_at,
            created_at = excluded.created_at,
            ingested_at = excluded.ingested_at,
            tombstoned = FALSE
        "#,
        user.uri,
        user.did,
        user.cid,
        user.name,
        user.bio,
        user.profile_picture_uri,
        user.sort_at.to_sqlx(),
        user.created_at.to_sqlx(),
        user.ingested_at.to_sqlx(),
    )
    .execute(pool)
    .await?;

    Ok(())
}

/// Mark the user with the given profile record uri as deleted.
///
/// # Errors
///
/// Will return an `Err` if the query fails.
pub async fn tombstone_user(pool: &PgPool, uri: &str) -> Result<()> {
    sqlx::query!("UPDATE users SET tombstoned = TRUE WHERE uri = $1", uri)
        .execute(pool)
        .await?;

    Ok(())
}

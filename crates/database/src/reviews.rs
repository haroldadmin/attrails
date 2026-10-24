use anyhow::Result;
use jiff::Timestamp;
use jiff_sqlx::ToSqlx;
use serde_json::Value;
use sqlx::PgPool;

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

/// Insert a review, or overwrite the existing row with the same uri.
///
/// Clears any tombstone, so a re-created record becomes visible again.
///
/// # Errors
///
/// Will return an `Err` if the query fails.
pub async fn upsert_review(pool: &PgPool, review: &NewReview) -> Result<()> {
    sqlx::query!(
        r#"
        INSERT INTO reviews (
            uri, cid, did, rkey, subject_uri, subject_cid, rating, body,
            images, sort_at, created_at, ingested_at, tombstoned
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, FALSE)
        ON CONFLICT (uri) DO UPDATE SET
            cid = excluded.cid,
            did = excluded.did,
            rkey = excluded.rkey,
            subject_uri = excluded.subject_uri,
            subject_cid = excluded.subject_cid,
            rating = excluded.rating,
            body = excluded.body,
            images = excluded.images,
            sort_at = excluded.sort_at,
            created_at = excluded.created_at,
            ingested_at = excluded.ingested_at,
            tombstoned = FALSE
        "#,
        review.uri,
        review.cid,
        review.did,
        review.rkey,
        review.subject_uri,
        review.subject_cid,
        review.rating,
        review.body,
        review.images,
        review.sort_at.to_sqlx(),
        review.created_at.to_sqlx(),
        review.ingested_at.to_sqlx(),
    )
    .execute(pool)
    .await?;

    Ok(())
}

/// Mark the review with the given uri as deleted.
///
/// # Errors
///
/// Will return an `Err` if the query fails.
pub async fn tombstone_review(pool: &PgPool, uri: &str) -> Result<()> {
    sqlx::query!("UPDATE reviews SET tombstoned = TRUE WHERE uri = $1", uri)
        .execute(pool)
        .await?;

    Ok(())
}

pub struct ReviewModerationView {
    pub uri: String,
    pub cid: String,
    pub body: Option<String>,
}

/// Fetches all the review information relevant for making
/// moderation decisions on it, or `None` if the review does not
/// exist or is tombstoned.
///
/// # Errors
///
/// Will return an `Err` if the query fails.
pub async fn fetch_review_moderation_view(
    pool: &PgPool,
    uri: &str,
) -> Result<Option<ReviewModerationView>> {
    let review = sqlx::query_as!(
        ReviewModerationView,
        r#"
            SELECT uri, cid, body
            FROM reviews
            WHERE uri = $1
              AND tombstoned = FALSE;
        "#,
        uri,
    )
    .fetch_optional(pool)
    .await?;

    Ok(review)
}

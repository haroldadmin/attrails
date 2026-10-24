use anyhow::Result;
use jiff::Timestamp;
use jiff_sqlx::ToSqlx;
use sqlx::PgPool;

/// Labels produced for one version of a record.
#[derive(Debug, Clone)]
pub struct NewLabels {
    pub uri: String,
    pub cid: String,
    pub vals: Vec<String>,
    pub cts: Timestamp,
    pub source: String,
}

/// Insert labels for a record version, skipping any that already exist.
///
/// # Errors
///
/// Will return an `Err` if the query fails.
pub async fn insert_labels(pool: &PgPool, labels: &NewLabels) -> Result<()> {
    sqlx::query!(
        r#"
        INSERT INTO labels (uri, cid, val, cts, source)
        SELECT $1, $2, val, $4, $5 FROM UNNEST($3::TEXT[]) AS val
        ON CONFLICT (uri, cid, val) DO NOTHING
        "#,
        labels.uri,
        labels.cid,
        &labels.vals,
        labels.cts.to_sqlx(),
        labels.source,
    )
    .execute(pool)
    .await?;

    Ok(())
}

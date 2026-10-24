use anyhow::Result;
use sqlx::postgres::PgPoolOptions;
use tracing::info;

pub use sqlx::PgPool;

pub mod labels;
pub mod reviews;
pub mod routes;
pub mod tracks;
pub mod users;

/// Open a connection pool to the Postgres instance at the given
/// connection uri.
///
/// # Errors
///
/// Will return an `Err` if the uri is invalid or a connection can not
/// be established.
pub async fn connect(postgres_uri: &str) -> Result<PgPool> {
    let pool = PgPoolOptions::new()
        .max_connections(10)
        .connect(postgres_uri)
        .await?;

    Ok(pool)
}

/// Verify that the pool can execute a trivial query.
///
/// # Errors
///
/// Returns an error if a connection can not be acquired or the query fails.
pub async fn ping(pool: PgPool) -> Result<()> {
    sqlx::query("SELECT 1").execute(&pool).await?;
    Ok(())
}

/// Apply any pending migrations from this crate's `migrations` directory.
///
/// # Errors
///
/// Will return an `Err` if a migration fails to apply, or if a previously
/// applied migration has been modified since it ran.
pub async fn migrate(pool: &PgPool) -> Result<()> {
    sqlx::migrate!().run(pool).await?;
    info!("Postgres migrations applied");

    Ok(())
}

# database

The database crate provides utilities to connect to a Postgres instance and run queries on it through `sqlx`.

Ensure `mise run db:sqlx:prepare` is run every time a query is added/modified. This ensures we generate query metadata so that compile time checks can run without a real database connection.

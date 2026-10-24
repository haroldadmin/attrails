-- Each user has a unique DID, but the first migration
-- that created the users table did not add a UNIQUE
-- index on the column. This migration fixes that.
--
-- Furthermore, there is no way to update an existing index
-- in Postgres with a UNIQUE constraint, so we must drop the
-- existing index first and then create a new one.

DROP INDEX IF EXISTS users_did_idx;

CREATE UNIQUE INDEX users_did_idx ON users (did);

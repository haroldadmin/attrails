# attrails

ATTrails is an ATProto app for sharing cycling, running, and hiking routes. It helps you share your collection and discover routes uploaded by others.

## Features

- Share your routes as GPX files with the world
- Discover routes shared by others
- Review and curate your personal collection of favorite routes

## Crates

- `ingest-watcher`: Watches relevant collections from an ATProto [Tap](https://github.com/bluesky-social/indigo/blob/main/cmd/tap/README.md) instance and enqueues any new events for processing.
- `ingest-consumer`: Processes events produced by `ingest-watcher` to transform and index routes, reviews, profiles, and GPX files.
- `lifecycle`: Shared liveness/readiness probes and graceful shutdown signal handling.
- `amqp`: Manages RabbitMQ connection and queues.
- `database`: Manages the Postgres connection pool and schema migrations.
- `lexicons`: Generated code for lexicons relevant to this app.
- `tracks`: Parses GPX files into track summaries, paths, and elevation profiles.

## Infrastructure

- Postgres + PostGIS for persistence
- RabbitMQ for messaging and job queues
- ATProto Tap for watching the Firehose
- Next.js web app for users

## Local Development

`compose.yaml` runs RabbitMQ and Tap. The `watcher` and `consumer` profiles add a containerised `ingest-watcher` or `ingest-consumer`, so the service being worked on can run with `cargo run` while compose provides the rest. Postgres is not included; the containers read `ATTRAILS_POSTGRES_CONNECTION_URI` from `.env`.

- `docker compose --profile consumer up`: Work on `ingest-watcher` (compose runs RabbitMQ, Tap, and `ingest-consumer`)
- `docker compose --profile watcher up`: Work on `ingest-consumer` (compose runs RabbitMQ, Tap, and `ingest-watcher`)
- `docker compose up`: Run only RabbitMQ and Tap
- `docker compose --profile watcher --profile consumer up`: Run everything in containers
- `docker compose --profile web up web`: Run the web frontend in a container on port 3000

Add `--build` to rebuild the service images after code changes.

## Migrations

Migrations live in `crates/database/migrations` and run with [sqlx-cli](https://github.com/launchbadge/sqlx/tree/main/sqlx-cli), installed via `mise install`. The target database is `ATTRAILS_POSTGRES_CONNECTION_URI` from `.env`.

- `mise run db:migrate:check`: List pending migrations without applying them
- `mise run db:migrate`: Apply pending migrations
- `sqlx migrate add <name>` (from `crates/database`): Create a new migration

Never edit a migration after it has been applied; add a new one instead.

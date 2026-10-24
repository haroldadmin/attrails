# ingest-consumer

Processes events produced by `ingest-watcher` to transform and index routes, reviews, profiles, and GPX files.

## Labels

Every route, review, and profile that is created or updated is queued on `tap-events-labels`. The labels consumer sends the text of the indexed version of the record to the Jev decisions API, with one yes/no question per content label (`porn`, `sexual`, `nudity`, `graphic-media`, `spam`, `rude`, `threat`). Labels whose probability is above 0.7 are stored in the `labels` table, keyed by the record's uri and cid, along with `!hide` (for `porn`, `threat`, or `spam`) or `!warn` (for any other label). Requests for a version that is no longer indexed, and reviews without text, are skipped.

The questions and the `!hide`/`!warn` rules live in `crates/moderation`. Set `RUST_LOG=moderation=debug` to log each request payload and the answers.

The API is configured with `ATTRAILS_DECISIONS_API_KEY` (required) and `ATTRAILS_DECISIONS_API_BASE_URL` (defaults to `https://api.typesafe.ai`).

## Probes

The consumer serves HTTP probes on `0.0.0.0:$ATTRAILS_HEALTH_PORT` (default `8081`):

- `GET /health/live` returns `200 OK` whenever the process is running. It does not check dependencies.
- `GET /health/ready` returns `200 OK` when startup has completed, the RabbitMQ channel is connected, and Postgres responds to a trivial query. It returns `503 Service Unavailable` while starting, while either dependency is unavailable, and while the process is shutting down.

Readiness check failures are included in the JSON response.

## Shutdown

`SIGTERM` and `SIGINT` trigger a graceful shutdown:

1. Readiness starts returning `503`.
2. All consumers are cancelled. New deliveries stop; a callback that is already running is allowed to finish.
3. The consumer wait is bounded to 30 seconds.
4. The RabbitMQ channel is closed. Unacked and prefetched messages are requeued by the broker.
5. The Postgres pool is closed.
6. The probe server is stopped.

Liveness keeps returning `200` during shutdown so the process is not restarted while it terminates.

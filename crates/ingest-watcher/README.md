# ingest-watcher

Connects to an ATProto Tap instance to ingest incoming events for ATTrails collections.

> The Tap instance should be configured with the `TAP_SIGNAL_COLLECTION` option set to `app.attrails.actor.profile` to ensure it only tracks repos that actively use ATTrails.

Listens for events from Tap, and enqueues them to the relevant job queue based on RabbitMQ.

## Probes

The watcher serves HTTP probes on `0.0.0.0:$ATTRAILS_HEALTH_PORT` (default `8080`):

- `GET /health/live` returns `200 OK` whenever the process is running. It does not check dependencies.
- `GET /health/ready` returns `200 OK` when startup has completed and the RabbitMQ channel is connected. It returns `503 Service Unavailable` while starting, while RabbitMQ is reconnecting, and while the process is shutting down.

Tap exposes no connection state, so readiness does not reflect Tap connectivity. The Tap client reconnects automatically.

## Shutdown

`SIGTERM` and `SIGINT` trigger a graceful shutdown:

1. Readiness starts returning `503`.
2. Events already buffered in the Tap stream are published, up to 64 events or 2 seconds. This is best-effort: Tap acknowledges events before they reach the watcher, so a crash or a full drain window can still lose events.
3. The Tap stream is closed.
4. The RabbitMQ channel is closed.

The drain and close steps are bounded to 10 seconds. Liveness keeps returning `200` during shutdown so the process is not restarted while it terminates.

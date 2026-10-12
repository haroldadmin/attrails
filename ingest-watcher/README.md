# ingest-watcher

Connects to an ATProto Tap instance to ingest incoming events for ATTrails collections.

> The Tap instance should be configured with the `TAP_SIGNAL_COLLECTION` option set to `app.attrails.actor.profile` to ensure it only tracks repos that actively use ATTrails.

Listens for events from Tap, and enqueues them to the relevant job queue based on RabbitMQ.

# attrails

ATTrails is an ATProto app for sharing cycling, running, and hiking routes. It helps you share your collection and discover routes uploaded by others.

## Features

- Share your routes as GPX files with the world
- Discover routes shared by others
- Review and curate your personal collection of favorite routes

## Crates

- `ingest-watcher`: Watches relevant collections from an ATProto [Tap](https://github.com/bluesky-social/indigo/blob/main/cmd/tap/README.md) instance and enqueues any new events for processing.
- `ingest-consumer`: Processes events produced by `ingest-watcher` to transform and index routes, reviews, profiles, and GPX files.
- `amqp`: Manages RabbitMQ connection and queues.
- `lexicons`: Generated code for lexicons relevant to this app.

## Infrastructure

- Postgres + PostGIS for persistence
- RabbitMQ for messaging and job queues
- ATProto Tap for watching the Firehose

# ATTrails Web

This directory is a Next.js based web application for ATTrails, a route sharing app built on ATProto.

Stack:

- Server functions for data fetching and streaming responses
- Cache components
- DaisyUI and Tailwind for styling

## OAuth

This application has support for ATProto OAuth. Users can login to their PDSes to manage records related to this application there.

It follows the ATProto loop:

1. Users write records to their PDS with this app
2. The Firehose notifies the app's ingestion layer, which writes to Postgres
3. The app queries Postgres to show the latest state

This means all actions are eventually consistent, and any writes or updates may not be immediately visible in the app.

## Hosting

This application runs as a self-hosted workload in Kubernetes.

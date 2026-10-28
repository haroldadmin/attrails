<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Data access

Domain modules in `src/lib/<domain>/` (starting with `reviews`) are the only way the app reads, validates, and writes that domain's data.

- Import a domain only through its entry points: `@/lib/<domain>` on the server, or `@/lib/<domain>/shared` from client components. Files behind them are internal.
- Name functions by what they do: `load*` reads the database, `fetch*` makes network calls, and `assert*` throws (or redirects) when an invariant doesn't hold.
- Let callers decide what to see through filters, such as `labelled: "include" | "exclude" | "only"`, rather than returning flags for callers to filter on.
- Report expected failures as typed reasons (`{ ok: false, reason }`) and map them to messages in the app, next to the UI that shows them.
- Database functions take an optional `signal: AbortSignal` and pass it to Kysely with `abortable(signal)`. Lookups that should be cheap default it to `AbortSignal.timeout(CHEAP_QUERY_TIMEOUT_MS)`.
- Validate input with Zod schemas exported from the domain's `shared` entry point.

## Tests

- Write a few focused tests that check behaviour people rely on, such as "only an account's newest review counts", not implementation details like the exact SQL or which helper was called.
- Test through a module's entry points, so tests survive refactors behind them.
- Prefer real dependencies over mocks: database tests run against Postgres with the real migrations (`setUpTestDatabase`, needs Docker). Fake only what's outside the system, such as a user's PDS.

import "server-only";

import type {
  NodeSavedSession,
  NodeSavedSessionStore,
  NodeSavedState,
  NodeSavedStateStore,
  RuntimeLock,
} from "@atproto/oauth-client-node";
import { sql } from "kysely";
import { getDb } from "@/db/client";

// Authorization requests that take longer than this to complete are dropped.
const stateExpiry = sql<Temporal.Instant>`now() - interval '1 hour'`;

export const stateStore: NodeSavedStateStore = {
  async get(key) {
    const db = await getDb();
    const row = await db
      .selectFrom("oauth_states")
      .select("value")
      .where("key", "=", key)
      .where("created_at", ">", stateExpiry)
      .executeTakeFirst();

    return row?.value as NodeSavedState | undefined;
  },

  async set(key, state) {
    const db = await getDb();
    await db
      .deleteFrom("oauth_states")
      .where("created_at", "<=", stateExpiry)
      .execute();
    await db
      .insertInto("oauth_states")
      .values({ key, value: JSON.stringify(state) })
      .execute();
  },

  async del(key) {
    const db = await getDb();
    await db.deleteFrom("oauth_states").where("key", "=", key).execute();
  },
};

export const sessionStore: NodeSavedSessionStore = {
  async get(did) {
    const db = await getDb();
    const row = await db
      .selectFrom("oauth_sessions")
      .select("value")
      .where("did", "=", did)
      .executeTakeFirst();

    return row?.value as NodeSavedSession | undefined;
  },

  async set(did, session) {
    const db = await getDb();
    const value = JSON.stringify(session);
    await db
      .insertInto("oauth_sessions")
      .values({ did, value })
      .onConflict((oc) =>
        oc.column("did").doUpdateSet({ value, updated_at: sql`now()` }),
      )
      .execute();
  },

  async del(did) {
    const db = await getDb();
    await db.deleteFrom("oauth_sessions").where("did", "=", did).execute();
  },
};

/**
 * Serializes token refreshes for a session across every server instance.
 *
 * Holds a transaction-scoped Postgres advisory lock while `fn` runs, so the
 * lock is released even if this process dies mid-refresh.
 */
export const requestLock: RuntimeLock = async (name, fn) => {
  const db = await getDb();
  return db.transaction().execute(async (trx) => {
    await sql`SET LOCAL lock_timeout = '30s'`.execute(trx);
    await sql`SELECT pg_advisory_xact_lock(hashtext(${name}))`.execute(trx);
    return fn();
  });
};

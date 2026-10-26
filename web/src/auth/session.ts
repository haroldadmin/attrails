import "server-only";

import { createHash, randomBytes } from "node:crypto";
import type { OAuthSession } from "@atproto/oauth-client-node";
import { sql } from "kysely";
import { cookies } from "next/headers";
import { cache } from "react";
import { getDb } from "@/db/client";
import { getOAuthClient, getWebUrl } from "./client";
import { logger } from "@/lib/logger";

const SESSION_COOKIE = "attrails_session";

const SESSION_MAX_AGE_SECONDS = 30 * 24 * 60 * 60; // 30 days

function hashSessionId(id: string): string {
  return createHash("sha256").update(id).digest("base64url");
}

/**
 * Returns the signed-in account's OAuth session, or `null` when signed out.
 *
 * Restoring the session refreshes its tokens when they have expired. A session
 * that can no longer be refreshed reads as signed out.
 */
export const getSession = cache(async (): Promise<OAuthSession | undefined> => {
  const id = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!id) {
    return undefined;
  }

  const db = await getDb();
  const row = await db
    .selectFrom("web_sessions")
    .select("did")
    .where("id_hash", "=", hashSessionId(id))
    .where("expires_at", ">", sql<Temporal.Instant>`now()`)
    .executeTakeFirst();

  if (!row) {
    return undefined;
  }

  try {
    return await getOAuthClient().restore(row.did);
  } catch (error) {
    logger.warn({ err: error, did: row.did }, "auth:restore");
    return undefined;
  }
});

/**
 * Signs this browser in as `did`. Call only from a Server Function or Route
 * Handler, after the OAuth session for `did` has been stored.
 */
export async function startWebSession(did: string): Promise<void> {
  const id = randomBytes(32).toString("base64url");

  const db = await getDb();
  await db
    .insertInto("web_sessions")
    .values({
      id_hash: hashSessionId(id),
      did,
      expires_at: sql<Temporal.Instant>`now() + make_interval(secs => ${SESSION_MAX_AGE_SECONDS})`,
    })
    .execute();

  (await cookies()).set(SESSION_COOKIE, id, {
    httpOnly: true,
    sameSite: "lax",
    secure: getWebUrl().protocol === "https:",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
}

/**
 * Signs this browser out. Revokes the account's OAuth session once no other
 * browser is signed in with it. Call only from a Server Function or Route
 * Handler.
 */
export async function endWebSession(): Promise<void> {
  const cookieStore = await cookies();
  const id = cookieStore.get(SESSION_COOKIE)?.value;
  cookieStore.delete(SESSION_COOKIE);
  if (!id) {
    return;
  }

  const db = await getDb();
  const ended = await db
    .deleteFrom("web_sessions")
    .where("id_hash", "=", hashSessionId(id))
    .returning("did")
    .executeTakeFirst();

  if (!ended) {
    return;
  }

  const remaining = await db
    .selectFrom("web_sessions")
    .select("id_hash")
    .where("did", "=", ended.did)
    .where("expires_at", ">", sql<Temporal.Instant>`now()`)
    .executeTakeFirst();

  if (remaining) {
    return;
  }

  try {
    await getOAuthClient().revoke(ended.did);
  } catch (error) {
    logger.warn({ err: error, did: ended.did }, "auth:revoke");
  }
}

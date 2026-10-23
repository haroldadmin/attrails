import "server-only";

import { Client, currentDatetimeString, XrpcResponseError } from "@atproto/lex";
import type { OAuthSession } from "@atproto/oauth-client-node";
import { app } from "@/lexicons";
import { fetchAuthorProfile } from "@/lib/profiles";

/**
 * Makes sure the signed-in account has an `app.attrails.actor.profile`
 * record, which is what marks it as an attrails user for ingestion.
 *
 * A new record is seeded from the account's Bluesky profile, when it has one.
 */
export async function ensureProfileDeclaration(
  session: OAuthSession,
): Promise<void> {
  const client = new Client(session);

  try {
    await client.get(app.attrails.actor.profile);
    return;
  } catch (error) {
    if (!isRecordNotFound(error)) {
      throw error;
    }
  }

  const bsky = await fetchBskyProfileRecord(client);
  const name =
    bsky?.displayName?.trim() ||
    (await fetchAuthorProfile(session.did)).handle ||
    session.did;

  await client.create(app.attrails.actor.profile, {
    name,
    bio: bsky?.description?.trim() || undefined,
    // The avatar blob already lives in this repo, so the new record can
    // reference it without uploading it again.
    profilePicture: bsky?.avatar,
    createdAt: currentDatetimeString(),
  });
}

async function fetchBskyProfileRecord(
  client: Client,
): Promise<app.bsky.actor.profile.Main | undefined> {
  try {
    const { value } = await client.get(app.bsky.actor.profile);
    return value;
  } catch (error) {
    if (!isRecordNotFound(error)) {
      console.warn(`auth:bsky-profile ${client.did}`, error);
    }
    return undefined;
  }
}

function isRecordNotFound(error: unknown): boolean {
  return error instanceof XrpcResponseError && error.error === "RecordNotFound";
}

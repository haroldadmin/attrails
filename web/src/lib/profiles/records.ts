import "server-only";

import {
  type Agent,
  Client,
  currentDatetimeString,
  XrpcResponseError,
} from "@atproto/lex";
import { app } from "@/lexicons";
import { logger } from "@/lib/logger";
import { fetchProfile } from "./queries";
import type { ProfileDraft } from "./shared";

const { profile } = app.attrails.actor;

function isRecordNotFound(error: unknown): boolean {
  return error instanceof XrpcResponseError && error.error === "RecordNotFound";
}

export type ProfileRecord = {
  /** The version of the record, for `saveProfile`. */
  cid: string | null;
  name: string;
  bio: string | null;
};

/**
 * Fetches the account's profile record from its PDS, which has the latest
 * saved values even before ingestion catches up. `null` if it has none.
 */
export async function fetchProfileRecord(
  agent: Agent,
): Promise<ProfileRecord | null> {
  try {
    const { cid, value } = await new Client(agent).get(profile);
    return { cid: cid ?? null, name: value.name, bio: value.bio ?? null };
  } catch (error) {
    if (isRecordNotFound(error)) {
      return null;
    }
    throw error;
  }
}

export type SaveProfileError =
  "conflict" | "not-found" | "invalid" | "write-failed";

export type SaveProfileResult =
  { ok: true } | { ok: false; reason: SaveProfileError };

/**
 * Saves `draft` over the account's profile record, keeping the fields people
 * don't edit, such as the profile picture. `swapCid` is the version the draft
 * was made from: if the record has changed since, nothing is saved.
 */
export async function saveProfile(
  agent: Agent,
  draft: ProfileDraft,
  { swapCid }: { swapCid: string | null },
): Promise<SaveProfileResult> {
  const client = new Client(agent);

  try {
    const current = await client.get(profile);
    const record = profile.$safeValidate({
      ...current.value,
      name: draft.name,
      bio: draft.bio || undefined,
    });
    if (!record.success) {
      return { ok: false, reason: "invalid" };
    }

    await client.put(profile, record.value, {
      swapRecord: swapCid ?? undefined,
    });
    return { ok: true };
  } catch (error) {
    if (error instanceof XrpcResponseError && error.error === "InvalidSwap") {
      return { ok: false, reason: "conflict" };
    }
    if (isRecordNotFound(error)) {
      return { ok: false, reason: "not-found" };
    }

    logger.warn({ err: error, did: client.did }, "profiles:save");
    return { ok: false, reason: "write-failed" };
  }
}

/**
 * Makes sure the account has a profile record, which is what marks it as an
 * ATTrails user for ingestion. A new record is seeded from the account's
 * Bluesky profile, when it has one.
 */
export async function ensureProfileRecord(agent: Agent): Promise<void> {
  const client = new Client(agent);
  if (await fetchProfileRecord(agent)) {
    return;
  }

  const bsky = await fetchBskyProfileRecord(client);
  const did = client.assertDid;
  const name =
    bsky?.displayName?.trim() || (await fetchProfile(did)).handle || did;

  await client.create(profile, {
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
      logger.warn({ err: error, did: client.did }, "profiles:bsky-profile");
    }
    return undefined;
  }
}

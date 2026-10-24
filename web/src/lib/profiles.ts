import "server-only";

import { Agent } from "@atproto/api";
import { sql } from "kysely";
import { cacheLife } from "next/cache";
import { cache } from "react";
import { getDb } from "@/db/client";

export type AuthorProfile = {
  did: string;
  handle: string | null;
  displayName: string | null;
  bio: string | null;
  avatarUrl: string | null;
};

const bskyAppView = new Agent({ service: "https://public.api.bsky.app" });

/**
 * Looks up an author's ATTrails profile.
 *
 * Authors without an ingested profile fall back to their handle, or their bare
 * DID, so the page still renders.
 */
export async function fetchAuthorProfile(did: string): Promise<AuthorProfile> {
  const [profile] = await fetchAuthorProfiles([did]);
  return profile;
}

/**
 * Looks up several authors' ATTrails profiles, returned in the same order as
 * `dids`. Falls back like `fetchAuthorProfile`.
 */
export async function fetchAuthorProfiles(
  dids: string[],
): Promise<AuthorProfile[]> {
  const uniqueDids = Array.from(new Set(dids));
  const [users, handles] = await Promise.all([
    fetchUsers(uniqueDids),
    fetchHandles(uniqueDids),
  ]);

  return dids.map((did) => toProfile(did, users.get(did), handles.get(did)));
}

/**
 * Looks up the profile of an ATTrails user, or `null` if `did` doesn't have an
 * ATTrails account.
 */
export const fetchUserProfile = cache(
  async (did: string): Promise<AuthorProfile | null> => {
    const [users, handles] = await Promise.all([
      fetchUsers([did]),
      fetchHandles([did]),
    ]);
    const user = users.get(did);
    return user ? toProfile(did, user, handles.get(did)) : null;
  },
);

function toProfile(
  did: string,
  user: User | undefined,
  handle: string | undefined,
): AuthorProfile {
  return {
    did,
    handle: handle ?? null,
    displayName: user?.name.trim() || null,
    bio: user?.bio?.trim() || null,
    avatarUrl: user?.pictureCid ? avatarUrl(did, user.pictureCid) : null,
  };
}

/**
 * Path of the route that serves `did`'s profile picture.
 */
export function avatarUrl(did: string, cid: string): string {
  return `/users/${encodeURIComponent(did)}/avatar/${encodeURIComponent(cid)}`;
}

/**
 * Fetches the content type of `did`'s profile picture, if `cid` is their
 * current one.
 */
export async function fetchAvatarMimeType(
  did: string,
  cid: string,
): Promise<string | undefined> {
  const db = await getDb();
  const row = await db
    .selectFrom("users")
    .select(sql<string>`profile_picture_uri->>'mimeType'`.as("mimeType"))
    .where("did", "=", did)
    .where("tombstoned", "=", false)
    .where(sql<string>`profile_picture_uri->'ref'->>'$link'`, "=", cid)
    .executeTakeFirst();

  return row?.mimeType;
}

type User = {
  name: string;
  bio: string | null;
  pictureCid: string | null;
};

async function fetchUsers(dids: string[]): Promise<Map<string, User>> {
  if (!dids.length) {
    return new Map();
  }

  const db = await getDb();
  const rows = await db
    .selectFrom("users")
    .select([
      "did",
      "name",
      "bio",
      sql<string | null>`profile_picture_uri->'ref'->>'$link'`.as("pictureCid"),
    ])
    .where("did", "in", dids)
    .where("tombstoned", "=", false)
    .execute();

  return new Map(rows.map(({ did, ...user }) => [did, user]));
}

// Handles aren't indexed yet, so they still come from the Bluesky AppView.
// Best-effort: failed lookups aren't cached and are retried on the next
// request.
async function fetchHandles(dids: string[]): Promise<Map<string, string>> {
  try {
    return await fetchBskyHandles(dids);
  } catch (error) {
    console.warn(`profiles:handles ${dids.join(" ")}`, error);
    return new Map();
  }
}

// Handle reported by the Bluesky AppView when bidirectional verification fails.
const INVALID_HANDLE = "handle.invalid";

async function fetchBskyHandles(dids: string[]): Promise<Map<string, string>> {
  "use cache";
  cacheLife("minutes");

  if (!dids.length) {
    return new Map();
  }

  const { data } = await bskyAppView.app.bsky.actor.getProfiles(
    { actors: dids },
    { signal: AbortSignal.timeout(1500) },
  );

  return new Map(
    data.profiles
      .filter((profile) => profile.handle !== INVALID_HANDLE)
      .map((profile) => [profile.did, profile.handle]),
  );
}

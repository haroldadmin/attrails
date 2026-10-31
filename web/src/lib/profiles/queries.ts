import "server-only";

import { sql } from "kysely";
import { cache } from "react";
import { abortable, CHEAP_QUERY_TIMEOUT_MS, getDb } from "@/db/client";
import { fetchBlob } from "@/lib/blobs";
import { logger } from "@/lib/logger";
import { fetchHandles } from "./appview";
import type { Profile } from "./shared";

type User = {
  name: string;
  bio: string | null;
  pictureCid: string | null;
};

async function loadUsers(
  dids: string[],
  signal: AbortSignal,
): Promise<Map<string, User>> {
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
    .execute(abortable(signal));

  return new Map(rows.map(({ did, ...user }) => [did, user]));
}

function toProfile(
  did: string,
  user: User | undefined,
  handle: string | undefined,
): Profile {
  return {
    did,
    handle: handle ?? null,
    displayName: user?.name.trim() || null,
    bio: user?.bio?.trim() || null,
    avatarUrl: user?.pictureCid
      ? `/users/${encodeURIComponent(did)}/avatar/${encodeURIComponent(user.pictureCid)}`
      : null,
  };
}

/**
 * Fetches the profiles of `dids`, in the same order. Accounts that aren't
 * ATTrails users, or whose handle can't be fetched, fall back to their handle
 * or bare DID, so pages still render.
 */
export async function fetchProfiles(
  dids: string[],
  {
    signal = AbortSignal.timeout(CHEAP_QUERY_TIMEOUT_MS),
  }: { signal?: AbortSignal } = {},
): Promise<Profile[]> {
  const uniqueDids = Array.from(new Set(dids));
  const [users, handles] = await Promise.all([
    loadUsers(uniqueDids, signal),
    fetchHandles(uniqueDids),
  ]);

  return dids.map((did) => toProfile(did, users.get(did), handles.get(did)));
}

/** Fetches one profile, falling back like `fetchProfiles`. */
export const fetchProfile = cache(
  async (did: string, options?: { signal?: AbortSignal }): Promise<Profile> => {
    const [profile] = await fetchProfiles([did], options);
    return profile;
  },
);

/**
 * Fetches the profile of an ATTrails user, or `null` if `did` doesn't have an
 * ATTrails account.
 */
export const fetchUserProfile = cache(
  async (
    did: string,
    {
      signal = AbortSignal.timeout(CHEAP_QUERY_TIMEOUT_MS),
    }: { signal?: AbortSignal } = {},
  ): Promise<Profile | null> => {
    const [users, handles] = await Promise.all([
      loadUsers([did], signal),
      fetchHandles([did]),
    ]);
    const user = users.get(did);
    return user ? toProfile(did, user, handles.get(did)) : null;
  },
);

// Raster formats only: an SVG served from our origin could run scripts.
const AVATAR_TYPES = new Set([
  "image/avif",
  "image/gif",
  "image/jpeg",
  "image/png",
  "image/webp",
]);

export type AvatarError = "not-found" | "unsupported" | "fetch-failed";

export type AvatarResult =
  | { ok: true; mimeType: string; blob: Response }
  | { ok: false; reason: AvatarError };

/**
 * Fetches `did`'s profile picture from their PDS, if `cid` is their current
 * one and it's a format that's safe to serve.
 */
export async function fetchAvatar(
  did: string,
  cid: string,
  {
    signal = AbortSignal.timeout(CHEAP_QUERY_TIMEOUT_MS),
  }: { signal?: AbortSignal } = {},
): Promise<AvatarResult> {
  const db = await getDb();
  const row = await db
    .selectFrom("users")
    .select(sql<string>`profile_picture_uri->>'mimeType'`.as("mimeType"))
    .where("did", "=", did)
    .where("tombstoned", "=", false)
    .where(sql<string>`profile_picture_uri->'ref'->>'$link'`, "=", cid)
    .executeTakeFirst(abortable(signal));

  if (!row) {
    return { ok: false, reason: "not-found" };
  }
  if (!AVATAR_TYPES.has(row.mimeType)) {
    return { ok: false, reason: "unsupported" };
  }

  try {
    return {
      ok: true,
      mimeType: row.mimeType,
      blob: await fetchBlob(did, cid),
    };
  } catch (error) {
    logger.warn({ err: error, did, cid }, "profiles:avatar");
    return { ok: false, reason: "fetch-failed" };
  }
}

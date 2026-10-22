import "server-only";

import { Agent, type AppBskyActorDefs } from "@atproto/api";
import { cacheLife } from "next/cache";

export type AuthorProfile = {
  did: string;
  handle: string | null;
  displayName: string | null;
  avatarUrl: string | null;
};

const bskyAppView = new Agent({ service: "https://public.api.bsky.app" });

/**
 * Looks up an author's Bluesky profile.
 *
 * Best-effort: when the lookup fails, the author falls back to their bare DID
 * so the page still renders. Failed lookups aren't cached and are retried on
 * the next request.
 */
export async function fetchAuthorProfile(did: string): Promise<AuthorProfile> {
  try {
    const profiles = await batchFetchAuthorProfiles([did]);
    const profile = profiles.get(did);
    return profile ?? unresolvedProfile(did);
  } catch (error) {
    console.warn(`profiles:fetch ${did}`, error);
    return unresolvedProfile(did);
  }
}

export async function batchFetchAuthorProfiles(
  dids: string[],
): Promise<Map<string, AuthorProfile>> {
  "use cache";
  cacheLife("minutes");

  if (!dids.length) {
    return new Map();
  }

  const { data } = await bskyAppView.app.bsky.actor.getProfiles(
    { actors: Array.from(new Set(dids)) },
    { signal: AbortSignal.timeout(1500) },
  );

  const profilesByDid = new Map<string, AuthorProfile>();
  for (let index = 0; index < dids.length; index++) {
    const did = dids[index];
    const profile = data.profiles[index];
    if (did && profile) {
      profilesByDid.set(did, toAuthorProfile(profile));
    }
  }

  return profilesByDid;
}

export function unresolvedProfile(did: string): AuthorProfile {
  return { did, handle: null, displayName: null, avatarUrl: null };
}

// Handle reported by the Bluesky AppView when bidirectional verification fails.
const INVALID_HANDLE = "handle.invalid";

function toAuthorProfile(
  profileView: AppBskyActorDefs.ProfileViewDetailed,
): AuthorProfile {
  return {
    did: profileView.did,
    handle: profileView.handle === INVALID_HANDLE ? null : profileView.handle,
    displayName: profileView.displayName?.trim() || null,
    avatarUrl: profileView.avatar
      ? avatarThumbnailUrl(profileView.avatar)
      : null,
  };
}

const BSKY_CDN_AVATAR_PREFIX = "https://cdn.bsky.app/img/avatar/plain/";

// The AppView returns full-size avatars (~60 KB). The CDN's thumbnail preset
// is a fraction of that and plenty for the sizes we render.
function avatarThumbnailUrl(avatarUrl: string): string {
  if (!avatarUrl.startsWith(BSKY_CDN_AVATAR_PREFIX)) {
    return avatarUrl;
  }

  const path = avatarUrl
    .slice(BSKY_CDN_AVATAR_PREFIX.length)
    .replace(/@\w+$/, "");
  return `https://cdn.bsky.app/img/avatar_thumbnail/plain/${path}@jpeg`;
}

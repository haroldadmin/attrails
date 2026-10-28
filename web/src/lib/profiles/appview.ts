import "server-only";

import { Agent } from "@atproto/api";
import { cacheLife } from "next/cache";
import { logger } from "@/lib/logger";
import type { ActorSuggestion } from "./shared";

// Handles aren't indexed yet, so they come from the Bluesky AppView.
// `fetch` is looked up on each call, so tests can stub it.
const bskyAppView = new Agent({
  service: "https://public.api.bsky.app",
  fetch: (input, init) => globalThis.fetch(input, init),
});

const TIMEOUT_MS = 1500;

// Handle reported by the Bluesky AppView when bidirectional verification fails.
const INVALID_HANDLE = "handle.invalid";

/**
 * Fetches the verified handles of `dids`, keyed by DID. Best-effort: failed
 * lookups aren't cached, and read as no handles.
 */
export async function fetchHandles(
  dids: string[],
): Promise<Map<string, string>> {
  try {
    return await fetchHandlesCached(dids);
  } catch (error) {
    logger.warn({ err: error, dids }, "profiles:handles");
    return new Map();
  }
}

async function fetchHandlesCached(
  dids: string[],
): Promise<Map<string, string>> {
  "use cache";
  cacheLife("minutes");

  if (!dids.length) {
    return new Map();
  }

  const { data } = await bskyAppView.app.bsky.actor.getProfiles(
    { actors: dids },
    { signal: AbortSignal.timeout(TIMEOUT_MS) },
  );

  return new Map(
    data.profiles
      .filter((profile) => profile.handle !== INVALID_HANDLE)
      .map((profile) => [profile.did, profile.handle]),
  );
}

/** Suggests Bluesky accounts whose handle or display name starts with `query`. */
export async function fetchActorSuggestions(
  query: string,
  { limit }: { limit: number },
): Promise<ActorSuggestion[]> {
  const { data } = await bskyAppView.app.bsky.actor.searchActorsTypeahead(
    { q: query, limit },
    { signal: AbortSignal.timeout(TIMEOUT_MS) },
  );

  return data.actors
    .filter((actor) => actor.handle !== INVALID_HANDLE)
    .map((actor) => ({
      did: actor.did,
      handle: actor.handle,
      displayName: actor.displayName?.trim() || null,
      avatarUrl: actor.avatar ?? null,
    }));
}

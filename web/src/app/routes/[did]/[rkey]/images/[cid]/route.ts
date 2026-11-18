import { getSession } from "@/auth/session";
import type { LabelledFilter } from "@/lib/moderation";
import {
  checkRouteImage,
  fetchRouteImage,
  type RouteImageError,
  type RouteRef,
} from "@/lib/routes";

const ERRORS: Record<RouteImageError, { status: number; message: string }> = {
  "not-found": { status: 404, message: "Photo not found." },
  unsupported: { status: 415, message: "Unsupported photo." },
  "fetch-failed": { status: 502, message: "We couldn't fetch the photo." },
};

// Not immutable: the photo stops being served once the route is labelled, so
// browsers revalidate (cheaply, with the ETag) after an hour.
const CACHE_CONTROL = "public, max-age=3600";

// Only the author sees the photos of a labelled route, so shared caches mustn't
// keep them, and browsers check back in case the labels change.
const AUTHOR_CACHE_CONTROL = "private, no-cache";

function matchesEtag(ifNoneMatch: string | null, etag: string) {
  if (!ifNoneMatch) {
    return false;
  }
  return ifNoneMatch
    .split(",")
    .map((candidate) => candidate.trim().replace(/^W\//, ""))
    .some((candidate) => candidate === "*" || candidate === etag);
}

/**
 * Runs `load` for everyone, then, if the photo wasn't found, again for the
 * route's author, who can see the photos of a labelled route.
 */
async function loadForViewer<
  T extends { ok: true } | { ok: false; reason: RouteImageError },
>(
  ref: RouteRef,
  load: (labelled: LabelledFilter) => Promise<T>,
): Promise<{ result: T; cacheControl: string }> {
  const result = await load("exclude");
  if (result.ok || result.reason !== "not-found") {
    return { result, cacheControl: CACHE_CONTROL };
  }

  const session = await getSession();
  if (session?.did !== ref.did) {
    return { result, cacheControl: CACHE_CONTROL };
  }
  return { result: await load("include"), cacheControl: AUTHOR_CACHE_CONTROL };
}

export async function GET(
  request: Request,
  { params }: RouteContext<"/routes/[did]/[rkey]/images/[cid]">,
) {
  const { did, rkey, cid } = await params;
  const ref = { did: decodeURIComponent(did), rkey };
  const etag = `"${cid}"`;

  if (matchesEtag(request.headers.get("If-None-Match"), etag)) {
    const { result: checked, cacheControl } = await loadForViewer(
      ref,
      (labelled) => checkRouteImage(ref, cid, { labelled }),
    );
    if (!checked.ok) {
      const { status, message } = ERRORS[checked.reason];
      return new Response(message, { status });
    }
    return new Response(null, {
      status: 304,
      headers: { "Cache-Control": cacheControl, ETag: etag },
    });
  }

  const { result: image, cacheControl } = await loadForViewer(ref, (labelled) =>
    fetchRouteImage(ref, cid, { labelled }),
  );
  if (!image.ok) {
    const { status, message } = ERRORS[image.reason];
    return new Response(message, { status });
  }

  const headers = new Headers({
    "Content-Type": image.mimeType,
    "Cache-Control": cacheControl,
    ETag: etag,
    "X-Content-Type-Options": "nosniff",
  });

  const length = image.blob.headers.get("Content-Length");
  if (length) {
    headers.set("Content-Length", length);
  }

  return new Response(image.blob.body, { headers });
}

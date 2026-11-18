import {
  checkRouteImage,
  fetchRouteImage,
  type RouteImageError,
} from "@/lib/routes";

const ERRORS: Record<RouteImageError, { status: number; message: string }> = {
  "not-found": { status: 404, message: "Photo not found." },
  unsupported: { status: 415, message: "Unsupported photo." },
  "fetch-failed": { status: 502, message: "We couldn't fetch the photo." },
};

// Not immutable: the photo stops being served once the route is labelled, so
// browsers revalidate (cheaply, with the ETag) after an hour.
const CACHE_CONTROL = "public, max-age=3600";

function matchesEtag(ifNoneMatch: string | null, etag: string) {
  if (!ifNoneMatch) {
    return false;
  }
  return ifNoneMatch
    .split(",")
    .map((candidate) => candidate.trim().replace(/^W\//, ""))
    .some((candidate) => candidate === "*" || candidate === etag);
}

export async function GET(
  request: Request,
  { params }: RouteContext<"/routes/[did]/[rkey]/images/[cid]">,
) {
  const { did, rkey, cid } = await params;
  const ref = { did: decodeURIComponent(did), rkey };
  const etag = `"${cid}"`;

  if (matchesEtag(request.headers.get("If-None-Match"), etag)) {
    const checked = await checkRouteImage(ref, cid);
    if (!checked.ok) {
      const { status, message } = ERRORS[checked.reason];
      return new Response(message, { status });
    }
    return new Response(null, {
      status: 304,
      headers: { "Cache-Control": CACHE_CONTROL, ETag: etag },
    });
  }

  const image = await fetchRouteImage(ref, cid);
  if (!image.ok) {
    const { status, message } = ERRORS[image.reason];
    return new Response(message, { status });
  }

  const headers = new Headers({
    "Content-Type": image.mimeType,
    "Cache-Control": CACHE_CONTROL,
    ETag: etag,
    "X-Content-Type-Options": "nosniff",
  });

  const length = image.blob.headers.get("Content-Length");
  if (length) {
    headers.set("Content-Length", length);
  }

  return new Response(image.blob.body, { headers });
}

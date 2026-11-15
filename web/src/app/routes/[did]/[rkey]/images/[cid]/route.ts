import { fetchRouteImage, type RouteImageError } from "@/lib/routes";

const ERRORS: Record<RouteImageError, { status: number; message: string }> = {
  "not-found": { status: 404, message: "Photo not found." },
  unsupported: { status: 415, message: "Unsupported photo." },
  "fetch-failed": { status: 502, message: "We couldn't fetch the photo." },
};

export async function GET(
  _request: Request,
  { params }: RouteContext<"/routes/[did]/[rkey]/images/[cid]">,
) {
  const { did, rkey, cid } = await params;

  const image = await fetchRouteImage(
    { did: decodeURIComponent(did), rkey },
    cid,
  );
  if (!image.ok) {
    const { status, message } = ERRORS[image.reason];
    return new Response(message, { status });
  }

  // Not immutable: the photo stops being served once the route is labelled.
  const headers = new Headers({
    "Content-Type": image.mimeType,
    "Cache-Control": "public, max-age=86400",
    "X-Content-Type-Options": "nosniff",
  });

  const length = image.blob.headers.get("Content-Length");
  if (length) {
    headers.set("Content-Length", length);
  }

  return new Response(image.blob.body, { headers });
}

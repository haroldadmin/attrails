import { fetchBlob } from "@/lib/blobs";
import { fetchAvatarMimeType } from "@/lib/profiles";

// Raster formats only: an SVG served from our origin could run scripts.
const IMAGE_TYPES = new Set([
  "image/avif",
  "image/gif",
  "image/jpeg",
  "image/png",
  "image/webp",
]);

export async function GET(
  _request: Request,
  { params }: RouteContext<"/users/[did]/avatar/[cid]">,
) {
  const { did: encodedDid, cid } = await params;
  const did = decodeURIComponent(encodedDid);

  const mimeType = await fetchAvatarMimeType(did, cid);
  if (!mimeType) {
    return new Response("Profile picture not found.", { status: 404 });
  }
  if (!IMAGE_TYPES.has(mimeType)) {
    return new Response("Unsupported profile picture.", { status: 415 });
  }

  let blob: Response;
  try {
    blob = await fetchBlob(did, cid);
  } catch (error) {
    console.warn(`users:avatar ${did}/${cid}`, error);
    return new Response("We couldn't fetch the profile picture.", {
      status: 502,
    });
  }

  const headers = new Headers({
    "Content-Type": mimeType,
    "Cache-Control": "public, max-age=3600, immutable",
    "X-Content-Type-Options": "nosniff",
  });

  const length = blob.headers.get("Content-Length");
  if (length) {
    headers.set("Content-Length", length);
  }

  return new Response(blob.body, { headers });
}

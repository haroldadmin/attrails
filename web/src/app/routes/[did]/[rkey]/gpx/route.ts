import { create as contentDisposition } from "content-disposition";
import { fetchRouteGpx } from "@/lib/routes";
import { fetchBlob } from "@/lib/blobs";

export async function GET(
  _request: Request,
  { params }: RouteContext<"/routes/[did]/[rkey]/gpx">,
) {
  const { did, rkey } = await params;
  const route = await fetchRouteGpx(decodeURIComponent(did), rkey);
  if (!route) {
    return new Response("Route not found.", { status: 404 });
  }

  let blob: Response;
  try {
    blob = await fetchBlob(route.did, route.gpxCid);
  } catch (error) {
    console.warn(`routes:gpx ${route.did}/${route.rkey}`, error);
    return new Response("We couldn't fetch the GPX file. Please try again.", {
      status: 502,
    });
  }

  const headers = new Headers({
    "Content-Type": "application/gpx+xml",
    "Content-Disposition": contentDisposition(fileName(route.name)),
    "Cache-Control": "public, max-age=3600, immutable",
    "X-Content-Type-Options": "nosniff",
  });

  const length = blob.headers.get("Content-Length");
  if (length) {
    headers.set("Content-Length", length);
  }

  return new Response(blob.body, { headers });
}

// Swaps out characters that aren't allowed in file names on common systems.
function fileName(routeName: string): string {
  const base = routeName
    .replace(/[\p{Cc}/\\:*?"<>|]+/gu, "-")
    .trim()
    .replace(/^\.+/, "");
  return `${base || "route"}.gpx`;
}

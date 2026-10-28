import { create as contentDisposition } from "content-disposition";
import { fetchRouteGpx, type RouteGpxError } from "@/lib/routes";

const ERRORS: Record<RouteGpxError, { status: number; message: string }> = {
  "not-found": { status: 404, message: "Route not found." },
  "fetch-failed": {
    status: 502,
    message: "We couldn't fetch the GPX file. Please try again.",
  },
};

export async function GET(
  _request: Request,
  { params }: RouteContext<"/routes/[did]/[rkey]/gpx">,
) {
  const { did, rkey } = await params;
  const gpx = await fetchRouteGpx(
    { did: decodeURIComponent(did), rkey },
    { labelled: "include" },
  );
  if (!gpx.ok) {
    const { status, message } = ERRORS[gpx.reason];
    return new Response(message, { status });
  }

  const headers = new Headers({
    "Content-Type": "application/gpx+xml",
    "Content-Disposition": contentDisposition(fileName(gpx.name)),
    "Cache-Control": "public, max-age=3600, immutable",
    "X-Content-Type-Options": "nosniff",
  });

  const length = gpx.blob.headers.get("Content-Length");
  if (length) {
    headers.set("Content-Length", length);
  }

  return new Response(gpx.blob.body, { headers });
}

// Swaps out characters that aren't allowed in file names on common systems.
function fileName(routeName: string): string {
  const base = routeName
    .replace(/[\p{Cc}/\\:*?"<>|]+/gu, "-")
    .trim()
    .replace(/^\.+/, "");
  return `${base || "route"}.gpx`;
}

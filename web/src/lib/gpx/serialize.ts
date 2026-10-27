import type { Element } from "xast";
import { toXml } from "xast-util-to-xml";
import { x } from "xastscript";
import type { Gpx, GpxPoint, GpxWaypoint } from "./types";

const DECIMALS = 6;

/**
 * Serializes `gpx` as compact GPX 1.1, with coordinates and elevations rounded
 * to 6 decimal places.
 */
export function serializeGpx(gpx: Gpx): string {
  const root = x(
    "gpx",
    {
      xmlns: "http://www.topografix.com/GPX/1/1",
      version: "1.1",
      creator: "ATTrails",
    },
    gpx.name || gpx.desc
      ? x(
          "metadata",
          {},
          optional("name", gpx.name),
          optional("desc", gpx.desc),
        )
      : undefined,
    gpx.waypoints.map(waypoint),
    gpx.routes.map((route) =>
      x(
        "rte",
        {},
        optional("name", route.name),
        optional("desc", route.desc),
        route.points.map((p) => point("rtept", p)),
      ),
    ),
    gpx.tracks.map((track) =>
      x(
        "trk",
        {},
        optional("name", track.name),
        optional("desc", track.desc),
        track.segments.map((points) =>
          x(
            "trkseg",
            points.map((p) => point("trkpt", p)),
          ),
        ),
      ),
    ),
  );

  return `<?xml version="1.0" encoding="UTF-8"?>${toXml(root, { closeEmptyElements: true, tightClose: true })}`;
}

function waypoint(wpt: GpxWaypoint) {
  return point(
    "wpt",
    wpt,
    optional("name", wpt.name),
    optional("desc", wpt.desc),
  );
}

function point(
  name: string,
  { lat, lon, ele }: GpxPoint,
  ...children: (Element | undefined)[]
) {
  return x(
    name,
    { lat: decimal(lat), lon: decimal(lon) },
    ele === undefined ? undefined : x("ele", decimal(ele)),
    ...children,
  );
}

function optional(name: string, text: string | undefined) {
  return text === undefined ? undefined : x(name, text);
}

function decimal(value: number): string {
  return String(Number(value.toFixed(DECIMALS)));
}

import { parseXml, XmlElement } from "@rgrove/parse-xml";
import { type Gpx, GpxError, type GpxPoint, type GpxWaypoint } from "./types";

// A decimal number, optionally with an exponent.
const DECIMAL = /^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?$/;

/**
 * Parses a GPX file, keeping only tracks, routes, waypoints, and their names
 * and descriptions. Track segments and routes with fewer than two points are
 * left out.
 *
 * Throws a `GpxError` if the file isn't GPX, has no segment or route left, or
 * has a malformed or out-of-range point. Malformed points are rejected rather
 * than skipped because the Rust ingester rejects the whole file for them.
 */
export function parseGpx(text: string): Gpx {
  let gpx;
  try {
    gpx = parseXml(text).root;
  } catch (error) {
    throw new GpxError("not-gpx", "Invalid XML", { cause: error });
  }

  if (gpx?.name !== "gpx") {
    throw new GpxError("not-gpx", "No <gpx> root element");
  }

  // GPX 1.1 nests the file's name in `<metadata>`, GPX 1.0 doesn't.
  const metadata = childElements(gpx, "metadata")[0] ?? gpx;
  const parsed: Gpx = {
    ...describe(metadata),
    waypoints: childElements(gpx, "wpt").map(parseWaypoint),
    routes: childElements(gpx, "rte")
      .map((route) => ({
        ...describe(route),
        points: childElements(route, "rtept").map(parsePoint),
      }))
      .filter((route) => route.points.length >= 2),
    tracks: childElements(gpx, "trk")
      .map((track) => ({
        ...describe(track),
        segments: childElements(track, "trkseg")
          .map((segment) => childElements(segment, "trkpt").map(parsePoint))
          .filter((points) => points.length >= 2),
      }))
      .filter((track) => track.segments.length > 0),
  };

  if (parsed.tracks.length === 0 && parsed.routes.length === 0) {
    throw new GpxError(
      "no-route",
      "No track segment or route with at least two points",
    );
  }

  return parsed;
}

function parseWaypoint(element: XmlElement): GpxWaypoint {
  return { ...parsePoint(element), ...describe(element) };
}

function parsePoint(element: XmlElement): GpxPoint {
  const lat = parseDecimal(element.attributes.lat);
  const lon = parseDecimal(element.attributes.lon);
  if (
    lat === undefined ||
    lon === undefined ||
    Math.abs(lat) > 90 ||
    Math.abs(lon) > 180
  ) {
    throw new GpxError("invalid-point", "Invalid latitude or longitude");
  }

  const eleText = childText(element, "ele");
  if (!eleText) {
    return { lat, lon };
  }

  const ele = parseDecimal(eleText);
  if (ele === undefined) {
    throw new GpxError("invalid-point", "Invalid elevation");
  }
  return { lat, lon, ele };
}

function parseDecimal(value: string | null | undefined): number | undefined {
  return value && DECIMAL.test(value) ? Number(value) : undefined;
}

function describe(element: XmlElement): { name?: string; desc?: string } {
  return {
    name: childText(element, "name")?.trim() || undefined,
    desc: childText(element, "desc")?.trim() || undefined,
  };
}

function childText(element: XmlElement, name: string): string | undefined {
  return childElements(element, name)[0]?.text;
}

function childElements(element: XmlElement, name: string): XmlElement[] {
  return element.children.filter(
    (node): node is XmlElement =>
      node instanceof XmlElement && node.name === name,
  );
}

import { geoInterpolate } from "d3-geo";
import { distanceBetween, gpxDistance } from "./derive";
import type { Gpx, GpxPoint } from "./types";

export const GPX_TRIM_METERS = 200;
export const GPX_TRIM_MIN_METERS = 500;

type Segments = readonly (readonly GpxPoint[])[];

/**
 * A file can hold the same path as both a track and a route, so each is trimmed
 * on its own. Trimming only the file's first and last points would expose ends.
 */
export function trimGpx(gpx: Gpx): Gpx | undefined {
  if (gpxDistance(gpx) < GPX_TRIM_MIN_METERS) {
    return undefined;
  }

  const tracks = gpx.tracks.flatMap((track) => {
    const segments = trimSegments(track.segments);
    return segments.length > 0 ? [{ ...track, segments }] : [];
  });
  const routes = gpx.routes.flatMap((route) => {
    const [points] = trimSegments([route.points]);
    return points ? [{ ...route, points }] : [];
  });
  if (tracks.length === 0 && routes.length === 0) {
    return undefined;
  }

  const ends = [
    ...gpx.tracks.map((track) => track.segments),
    ...gpx.routes.map((route) => [route.points]),
  ].flatMap((segments) => [segments[0][0], segments.at(-1)!.at(-1)!]);

  return {
    ...gpx,
    tracks,
    routes,
    waypoints: gpx.waypoints.filter((waypoint) =>
      ends.every((end) => distanceBetween(waypoint, end) > GPX_TRIM_METERS),
    ),
  };
}

function trimSegments(segments: Segments): Segments {
  return reversed(trimStart(reversed(trimStart(segments))));
}

function reversed(segments: Segments): Segments {
  return segments.toReversed().map((points) => points.toReversed());
}

function trimStart(segments: Segments): Segments {
  let remaining = GPX_TRIM_METERS;
  for (const [segment, points] of segments.entries()) {
    for (let index = 1; index < points.length; index++) {
      const length = distanceBetween(points[index - 1], points[index]);
      if (length > remaining) {
        const cut = pointBetween(
          points[index - 1],
          points[index],
          remaining / length,
        );
        return [[cut, ...points.slice(index)], ...segments.slice(segment + 1)];
      }
      remaining -= length;
    }
  }
  return [];
}

function pointBetween(a: GpxPoint, b: GpxPoint, fraction: number): GpxPoint {
  const [lon, lat] = geoInterpolate([a.lon, a.lat], [b.lon, b.lat])(fraction);
  return a.ele === undefined || b.ele === undefined
    ? { lat, lon }
    : { lat, lon, ele: a.ele + (b.ele - a.ele) * fraction };
}

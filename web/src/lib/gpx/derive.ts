import { geoDistance } from "d3-geo";
import type { MultiLineString } from "geojson";
import type { Gpx, GpxPoint } from "./types";

const EARTH_RADIUS_METERS = 6_371_000;
const ELEVATION_NOISE_METERS = 4;
const LOOP_THRESHOLD_METERS = 200;

/** The name of the first track or route, or else of the file. */
export function gpxName(gpx: Gpx): string | undefined {
  return gpx.tracks[0]?.name ?? gpx.routes[0]?.name ?? gpx.name;
}

/** Every track segment and route as a line, tracks first. */
export function gpxPath(gpx: Gpx): MultiLineString {
  return {
    type: "MultiLineString",
    coordinates: lines(gpx).map((points) =>
      points.map(({ lon, lat }) => [lon, lat]),
    ),
  };
}

/** Length in meters, not counting gaps between segments. */
export function gpxDistance(gpx: Gpx): number {
  let distance = 0;
  for (const points of lines(gpx)) {
    for (let index = 1; index < points.length; index++) {
      distance += distanceBetween(points[index - 1], points[index]);
    }
  }
  return distance;
}

/**
 * Elevation gained and lost in meters, ignoring changes smaller than GPS
 * noise. `undefined` if no point has an elevation.
 */
export function gpxElevation(
  gpx: Gpx,
): { gainM: number; lossM: number } | undefined {
  const elevations = lines(gpx)
    .flat()
    .flatMap(({ ele }) => (ele === undefined ? [] : [ele]));
  if (elevations.length === 0) {
    return undefined;
  }

  let gainM = 0;
  let lossM = 0;
  let reference = elevations[0];
  for (const elevation of elevations) {
    const change = elevation - reference;
    if (Math.abs(change) >= ELEVATION_NOISE_METERS) {
      if (change > 0) {
        gainM += change;
      } else {
        lossM -= change;
      }
      reference = elevation;
    }
  }
  return { gainM, lossM };
}

/** Whether the path ends within 200 meters of where it starts. */
export function isGpxLoop(gpx: Gpx): boolean {
  const all = lines(gpx);
  const start = all[0][0];
  const end = all[all.length - 1].at(-1)!;
  return distanceBetween(start, end) < LOOP_THRESHOLD_METERS;
}

function lines(gpx: Gpx): (readonly GpxPoint[])[] {
  return [
    ...gpx.tracks.flatMap((track) => track.segments),
    ...gpx.routes.map((route) => route.points),
  ];
}

function distanceBetween(a: GpxPoint, b: GpxPoint): number {
  return geoDistance([a.lon, a.lat], [b.lon, b.lat]) * EARTH_RADIUS_METERS;
}

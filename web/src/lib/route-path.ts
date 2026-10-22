import { geoMercator, geoPath } from "d3-geo";
import type { LineString, MultiLineString } from "geojson";

export type Point = [x: number, y: number];

export type ProjectedPath = {
  /** SVG path data for every line in the track. */
  d: string;
  start: Point;
  end: Point;
};

/**
 * Projects a track onto a `width` x `height` SVG viewport with a Mercator
 * projection, scaled to fit inside `padding` and centered.
 *
 * Returns `null` for tracks without any extent, such as a single point.
 */
export function projectPath(
  geometry: LineString | MultiLineString,
  {
    width,
    height,
    padding,
  }: { width: number; height: number; padding: number },
): ProjectedPath | null {
  const lines =
    geometry.type === "LineString"
      ? [geometry.coordinates]
      : geometry.coordinates;
  const first = lines.at(0)?.at(0);
  const last = lines.at(-1)?.at(-1);
  if (!first || !last) {
    return null;
  }

  const projection = geoMercator().fitExtent(
    [
      [padding, padding],
      [width - padding, height - padding],
    ],
    geometry,
  );
  if (!Number.isFinite(projection.scale())) {
    return null;
  }

  const d = geoPath(projection).digits(1)(geometry);
  const start = projection([first[0], first[1]]);
  const end = projection([last[0], last[1]]);
  if (!d || !start || !end) {
    return null;
  }

  return { d, start: roundPoint(start), end: roundPoint(end) };
}

function roundPoint([x, y]: Point): Point {
  return [Math.round(x * 10) / 10, Math.round(y * 10) / 10];
}

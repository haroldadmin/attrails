import { gpx } from "@tmcw/togeojson";

/** `maxSize` of the `track` blob in the `app.attrails.route` lexicon. */
export const GPX_MAX_SIZE_BYTES = 976_563;

/**
 * Whether a parsed GPX document has a track the ingester can use: a track
 * (`<trk>`) or route (`<rte>`) segment with at least two points.
 */
export function hasGpxTrack(doc: Parameters<typeof gpx>[0]): boolean {
  return gpx(doc).features.some(({ geometry }) => {
    switch (geometry?.type) {
      case "LineString":
        return geometry.coordinates.length >= 2;
      case "MultiLineString":
        return geometry.coordinates.some((line) => line.length >= 2);
      default:
        return false;
    }
  });
}

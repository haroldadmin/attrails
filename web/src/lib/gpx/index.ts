export { parseGpx } from "./parse";
export { serializeGpx } from "./serialize";
export {
  gpxDistance,
  gpxElevation,
  gpxName,
  gpxPath,
  isGpxLoop,
} from "./derive";
export {
  type Gpx,
  GpxError,
  type GpxErrorReason,
  type GpxPoint,
  type GpxRoute,
  type GpxTrack,
  type GpxWaypoint,
} from "./types";

/** `maxSize` of the `track` blob in the `app.attrails.route` lexicon. */
export const GPX_MAX_SIZE_BYTES = 976_563;

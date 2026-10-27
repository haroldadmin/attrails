/**
 * The parts of a GPX file that ATTrails uses. Segments and routes always have
 * at least two points.
 */
export type Gpx = {
  readonly name?: string;
  readonly desc?: string;
  readonly waypoints: readonly GpxWaypoint[];
  readonly routes: readonly GpxRoute[];
  readonly tracks: readonly GpxTrack[];
};

export type GpxPoint = {
  readonly lat: number;
  readonly lon: number;
  readonly ele?: number;
};

export type GpxWaypoint = GpxPoint & {
  readonly name?: string;
  readonly desc?: string;
};

export type GpxRoute = {
  readonly name?: string;
  readonly desc?: string;
  readonly points: readonly GpxPoint[];
};

export type GpxTrack = {
  readonly name?: string;
  readonly desc?: string;
  readonly segments: readonly (readonly GpxPoint[])[];
};

export type GpxErrorReason = "not-gpx" | "no-route" | "invalid-point";

/** A file that isn't GPX, or that ATTrails can't use. */
export class GpxError extends Error {
  name = "GpxError";

  constructor(
    readonly reason: GpxErrorReason,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
  }
}

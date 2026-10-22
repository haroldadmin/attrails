import "server-only";

import type { LineString, MultiLineString } from "geojson";
import { sql } from "kysely";
import { cache } from "react";
import { getDb } from "@/db/client";

export type RouteSummary = {
  did: string;
  rkey: string;
  name: string;
  /** Lexicon token, e.g. `app.attrails.v0.defs#cycling`. */
  activity: string;
  uploadedAt: Temporal.Instant;
  distanceM: number;
  elevationGainM: number | null;
  isLoop: boolean;
  /** Simplified track geometry in WGS 84 (lon, lat). */
  path: LineString | MultiLineString;
};

// Simplification tolerance as a fraction of the track's larger bounding box
// side.
const SIMPLIFY_FRACTION = 1 / 500;

/**
 * Fetches the most recently ingested routes with tracks.
 */
export async function fetchRecentRoutes(
  limit: number,
): Promise<RouteSummary[]> {
  const db = await getDb();

  const geom = sql`tracks.path::geometry`;
  const tolerance = sql`GREATEST(
    ST_XMax(${geom}) - ST_XMin(${geom}),
    ST_YMax(${geom}) - ST_YMin(${geom})
  ) * ${SIMPLIFY_FRACTION}`;

  const rows = await db
    .selectFrom("routes")
    .innerJoin("tracks", "tracks.cid", "routes.gpx_cid")
    .select([
      "routes.did",
      "routes.rkey",
      "routes.name",
      "routes.activity",
      "routes.sort_at as uploadedAt",
      "tracks.distance_m as distanceM",
      "tracks.elevation_gain_m as elevationGainM",
      "tracks.is_loop as isLoop",
      sql<string>`ST_AsGeoJSON(ST_Simplify(${geom}, ${tolerance}), 6)`.as(
        "pathGeoJson",
      ),
    ])
    .where("routes.tombstoned", "=", false)
    .where("tracks.path", "is not", null)
    .orderBy("routes.sort_at", "desc")
    .limit(limit)
    .execute();

  return rows.map(({ pathGeoJson, ...row }) => ({
    ...row,
    path: JSON.parse(pathGeoJson),
  }));
}

export type Route = {
  did: string;
  rkey: string;
  name: string;
  description: string | null;
  activity: string;
  surface: string | null;
  difficulty: string | null;
  tags: string[];
  createdAt: Temporal.Instant;
  distanceM: number;
  elevationGainM: number | null;
  elevationLossM: number | null;
  isLoop: boolean;
  path: MultiLineString;
  /** Empty if the track has no elevation data. */
  elevationProfile: ElevationSample[];
  reviewCount: number;
};

export type ElevationSample = [distanceM: number, elevationM: number];

/**
 * Fetches a route with its track, or `null` if it doesn't exist or hasn't
 * been processed yet.
 */
export const fetchRoute = cache(
  async (did: string, rkey: string): Promise<Route | null> => {
    const db = await getDb();

    const row = await db
      .selectFrom("routes")
      .innerJoin("tracks", "tracks.cid", "routes.gpx_cid")
      .select([
        "routes.did",
        "routes.rkey",
        "routes.name",
        "routes.description",
        "routes.activity",
        "routes.surface",
        "routes.difficulty",
        "routes.tags",
        "routes.created_at as createdAt",
        "tracks.distance_m as distanceM",
        "tracks.elevation_gain_m as elevationGainM",
        "tracks.elevation_loss_m as elevationLossM",
        "tracks.is_loop as isLoop",
        sql<string>`ST_AsGeoJSON(tracks.path, 6)`.as("pathGeoJson"),
        sql<
          ElevationSample[]
        >`COALESCE(tracks.elevation_profile, '[]'::jsonb)`.as(
          "elevationProfile",
        ),
        (eb) =>
          eb
            .selectFrom("reviews")
            .select(sql<number>`COUNT(*)::int`.as("count"))
            .whereRef("reviews.subject_uri", "=", "routes.uri")
            .where("reviews.tombstoned", "=", false)
            .$asScalar()
            .$notNull()
            .as("reviewCount"),
      ])
      .where("routes.did", "=", did)
      .where("routes.rkey", "=", rkey)
      .where("routes.tombstoned", "=", false)
      .where("tracks.path", "is not", null)
      .executeTakeFirst();

    if (!row) {
      return null;
    }

    const { pathGeoJson, ...route } = row;
    return { ...route, path: JSON.parse(pathGeoJson) };
  },
);

export type RouteGpx = {
  did: string;
  rkey: string;
  name: string;
  gpxCid: string;
};

/**
 * Fetches what's needed to download a route's GPX file, or `null` if the
 * route doesn't exist.
 */
export async function fetchRouteGpx(
  did: string,
  rkey: string,
): Promise<RouteGpx | null> {
  const db = await getDb();

  const row = await db
    .selectFrom("routes")
    .select(["did", "rkey", "name", "gpx_cid as gpxCid"])
    .where("did", "=", did)
    .where("rkey", "=", rkey)
    .where("tombstoned", "=", false)
    .executeTakeFirst();

  return row ?? null;
}

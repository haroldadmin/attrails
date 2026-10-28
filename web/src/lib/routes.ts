import "server-only";

import type { LineString, MultiLineString } from "geojson";
import { sql } from "kysely";
import { cache } from "react";
import {
  abortable,
  type AttrailsDb,
  CHEAP_QUERY_TIMEOUT_MS,
  getDb,
} from "@/db/client";
import type { Location } from "@/lib/location";
import { isLabelled } from "@/lib/moderation";
import type { Page } from "@/lib/pages";
import { after, decodeCursor, toPage } from "./pagination";

export type RouteSummary = {
  did: string;
  rkey: string;
  name: string;
  /** Lexicon token, e.g. `app.attrails.defs#cycling`. */
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

// Selects publicly listable routes with tracks as summary rows, leaving out
// routes with moderation labels.
function routeSummaries(db: AttrailsDb) {
  const geom = sql`tracks.path::geometry`;
  const tolerance = sql`GREATEST(
    ST_XMax(${geom}) - ST_XMin(${geom}),
    ST_YMax(${geom}) - ST_YMin(${geom})
  ) * ${SIMPLIFY_FRACTION}`;

  return db
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
    .where((eb) => eb.not(isLabelled("routes.uri", "routes.cid")));
}

function toRouteSummary<T extends { pathGeoJson: string }>({
  pathGeoJson,
  ...row
}: T): Omit<T, "pathGeoJson"> & Pick<RouteSummary, "path"> {
  return { ...row, path: JSON.parse(pathGeoJson) };
}

/**
 * Fetches a page of the most recently ingested routes with tracks, leaving out
 * routes with moderation labels. With `activity`, only routes for that
 * activity are listed.
 */
export async function fetchRoutesPage({
  activity,
  cursor,
  limit,
}: {
  activity?: string;
  cursor?: string;
  limit: number;
}): Promise<Page<RouteSummary>> {
  const db = await getDb();
  const position = cursor ? decodeCursor(cursor) : undefined;
  if (position === null) {
    return { items: [], nextCursor: null };
  }

  let query = routeSummaries(db);
  if (activity) {
    query = query.where("routes.activity", "=", activity);
  }
  if (position) {
    query = query.where(
      after("routes.sort_at", "routes.did", "routes.rkey", position),
    );
  }

  const rows = await query
    .orderBy("routes.sort_at", "desc")
    .orderBy("routes.did", "desc")
    .orderBy("routes.rkey", "desc")
    .limit(limit + 1)
    .execute();

  const page = toPage(rows, limit, ({ uploadedAt, did, rkey }) => ({
    sortAt: uploadedAt,
    did,
    rkey,
  }));
  return { ...page, items: page.items.map(toRouteSummary) };
}

/**
 * Fetches the most recently ingested routes with tracks, leaving out routes
 * with moderation labels.
 */
export async function fetchRecentRoutes(
  limit: number,
): Promise<RouteSummary[]> {
  return (await fetchRoutesPage({ limit })).items;
}

/**
 * Fetches the routes that start within `radiusM` metres of `location`,
 * nearest first, leaving out routes with moderation labels.
 */
export async function fetchRoutesNear(
  location: Location,
  { radiusM, limit }: { radiusM: number; limit: number },
): Promise<RouteSummary[]> {
  const db = await getDb();

  const point = sql`ST_SetSRID(
    ST_MakePoint(${location.longitude}, ${location.latitude}), 4326
  )::geography`;

  const rows = await routeSummaries(db)
    .where(sql<boolean>`ST_DWithin(tracks.start_point, ${point}, ${radiusM})`)
    .orderBy(sql`tracks.start_point <-> ${point}`)
    .limit(limit)
    .execute();

  return rows.map(toRouteSummary);
}

export type RouteListing = {
  did: string;
  rkey: string;
  name: string;
  activity: string;
  uploadedAt: Temporal.Instant;
};

/**
 * Fetches a page of `did`'s routes with tracks, newest first. With
 * `hideLabelled`, routes with moderation labels are left out.
 */
export async function fetchRoutesByAuthor(
  did: string,
  {
    cursor,
    limit,
    hideLabelled = false,
  }: { cursor?: string; limit: number; hideLabelled?: boolean },
): Promise<Page<RouteListing>> {
  const db = await getDb();
  const position = cursor ? decodeCursor(cursor) : undefined;
  if (position === null) {
    return { items: [], nextCursor: null };
  }

  let query = db
    .selectFrom("routes")
    .innerJoin("tracks", "tracks.cid", "routes.gpx_cid")
    .select([
      "routes.did",
      "routes.rkey",
      "routes.name",
      "routes.activity",
      "routes.sort_at as uploadedAt",
    ])
    .where("routes.did", "=", did)
    .where("routes.tombstoned", "=", false)
    .where("tracks.path", "is not", null);
  if (position) {
    query = query.where(
      after("routes.sort_at", "routes.did", "routes.rkey", position),
    );
  }
  if (hideLabelled) {
    query = query.where((eb) => eb.not(isLabelled("routes.uri", "routes.cid")));
  }

  const rows = await query
    .orderBy("routes.sort_at", "desc")
    .orderBy("routes.did", "desc")
    .orderBy("routes.rkey", "desc")
    .limit(limit + 1)
    .execute();

  return toPage(rows, limit, ({ uploadedAt, did, rkey }) => ({
    sortAt: uploadedAt,
    did,
    rkey,
  }));
}

export type RouteSearchResult = {
  did: string;
  rkey: string;
  name: string;
  activity: string;
  distanceM: number;
};

const MAX_SEARCH_TERMS = 5;

/**
 * Searches route names for every word in `query`, matching each word as a
 * prefix so partial input finds routes as it's typed. Best matches come
 * first. Routes with moderation labels are left out.
 */
export async function searchRoutes(
  query: string,
  limit: number,
): Promise<RouteSearchResult[]> {
  // Only letters and digits reach `to_tsquery`, so its syntax can't be
  // injected and the call can't fail.
  const terms = query
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean)
    .slice(0, MAX_SEARCH_TERMS);
  if (terms.length === 0) {
    return [];
  }

  const db = await getDb();
  const tsquery = sql`to_tsquery('simple', ${terms.map((term) => `${term}:*`).join(" & ")})`;

  return db
    .selectFrom("routes")
    .innerJoin("tracks", "tracks.cid", "routes.gpx_cid")
    .select([
      "routes.did",
      "routes.rkey",
      "routes.name",
      "routes.activity",
      "tracks.distance_m as distanceM",
    ])
    .where(sql<boolean>`routes.name_tsv @@ ${tsquery}`)
    .where("routes.tombstoned", "=", false)
    .where("tracks.path", "is not", null)
    .where((eb) => eb.not(isLabelled("routes.uri", "routes.cid")))
    .orderBy(sql`ts_rank_cd(routes.name_tsv, ${tsquery})`, "desc")
    .orderBy("routes.sort_at", "desc")
    .limit(limit)
    .execute();
}

export type Route = {
  uri: string;
  cid: string;
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
  /** Whether this version of the route has moderation labels. */
  labelled: boolean;
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
        "routes.uri",
        "routes.cid",
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
        isLabelled("routes.uri", "routes.cid").as("labelled"),
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

/**
 * Fetches what a route's link preview image shows, with a simplified track.
 * Returns `null` if the route doesn't exist, hasn't been processed yet, or
 * has moderation labels.
 */
export async function fetchRouteCard(
  did: string,
  rkey: string,
): Promise<RouteSummary | null> {
  const db = await getDb();

  const row = await routeSummaries(db)
    .where("routes.did", "=", did)
    .where("routes.rkey", "=", rkey)
    .executeTakeFirst();

  return row ? toRouteSummary(row) : null;
}

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

/**
 * Loads the names of the routes at `uris`, keyed by URI. Routes that don't
 * exist are left out.
 */
export async function loadRouteNames(
  uris: string[],
  {
    signal = AbortSignal.timeout(CHEAP_QUERY_TIMEOUT_MS),
  }: { signal?: AbortSignal } = {},
): Promise<Map<string, string>> {
  if (uris.length === 0) {
    return new Map();
  }

  const db = await getDb();
  const rows = await db
    .selectFrom("routes")
    .select(["uri", "name"])
    .where("uri", "in", uris)
    .where("tombstoned", "=", false)
    .execute(abortable(signal));

  return new Map(rows.map(({ uri, name }) => [uri, name]));
}

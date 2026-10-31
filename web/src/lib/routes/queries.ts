import "server-only";

import { sql } from "kysely";
import {
  abortable,
  type AttrailsDb,
  CHEAP_QUERY_TIMEOUT_MS,
  getDb,
} from "@/db/client";
import { fetchBlob } from "@/lib/blobs";
import type { Location } from "@/lib/location";
import { logger } from "@/lib/logger";
import { type LabelledFilter, matchesLabelled } from "@/lib/moderation";
import type { Page } from "@/lib/pages";
import { after, decodeCursor, toPage } from "@/lib/pagination";
import type {
  ElevationSample,
  Route,
  RouteHeadline,
  RouteRef,
  RouteSummary,
} from "./shared";

// Simplification tolerance as a fraction of the track's larger bounding box
// side.
const SIMPLIFY_FRACTION = 1 / 500;

// Routes are listed once their track has been processed.
function routeHeadlines(db: AttrailsDb, labelled: LabelledFilter) {
  return db
    .selectFrom("routes")
    .innerJoin("tracks", "tracks.cid", "routes.gpx_cid")
    .select([
      "routes.uri",
      "routes.did",
      "routes.rkey",
      "routes.name",
      "routes.activity",
      "routes.sort_at as uploadedAt",
      "tracks.distance_m as distanceM",
    ])
    .where("routes.tombstoned", "=", false)
    .where("tracks.path", "is not", null)
    .where(matchesLabelled(labelled, "routes.uri", "routes.cid"));
}

function routeSummaries(db: AttrailsDb, labelled: LabelledFilter) {
  const geom = sql`tracks.path::geometry`;
  const tolerance = sql`GREATEST(
    ST_XMax(${geom}) - ST_XMin(${geom}),
    ST_YMax(${geom}) - ST_YMin(${geom})
  ) * ${SIMPLIFY_FRACTION}`;

  return routeHeadlines(db, labelled).select([
    "tracks.elevation_gain_m as elevationGainM",
    "tracks.is_loop as isLoop",
    sql<string>`ST_AsGeoJSON(ST_Simplify(${geom}, ${tolerance}), 6)`.as(
      "pathGeoJson",
    ),
  ]);
}

function toRouteSummary<T extends { pathGeoJson: string }>({
  pathGeoJson,
  ...row
}: T): Omit<T, "pathGeoJson"> & Pick<RouteSummary, "path"> {
  return { ...row, path: JSON.parse(pathGeoJson) };
}

/**
 * Loads a page of routes, newest first. With `activity` or `author`, only
 * their routes are listed.
 */
export async function loadRoutes({
  activity,
  author,
  labelled,
  cursor,
  limit,
  signal,
}: {
  activity?: string;
  author?: string;
  labelled: LabelledFilter;
  cursor?: string;
  limit: number;
  signal?: AbortSignal;
}): Promise<Page<RouteSummary>> {
  const position = cursor ? decodeCursor(cursor) : undefined;
  if (position === null) {
    return { items: [], nextCursor: null };
  }

  const db = await getDb();
  let query = routeSummaries(db, labelled);
  if (activity) {
    query = query.where("routes.activity", "=", activity);
  }
  if (author) {
    query = query.where("routes.did", "=", author);
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
    .execute(abortable(signal));

  const page = toPage(rows, limit, ({ uploadedAt, did, rkey }) => ({
    sortAt: uploadedAt,
    did,
    rkey,
  }));
  return { ...page, items: page.items.map(toRouteSummary) };
}

/** Loads the routes that start within `radiusM` metres of `location`, nearest first. */
export async function loadRoutesNear(
  location: Location,
  {
    radiusM,
    labelled,
    limit,
    signal,
  }: {
    radiusM: number;
    labelled: LabelledFilter;
    limit: number;
    signal?: AbortSignal;
  },
): Promise<RouteSummary[]> {
  const db = await getDb();

  const point = sql`ST_SetSRID(
    ST_MakePoint(${location.longitude}, ${location.latitude}), 4326
  )::geography`;

  const rows = await routeSummaries(db, labelled)
    .where(sql<boolean>`ST_DWithin(tracks.start_point, ${point}, ${radiusM})`)
    .orderBy(sql`tracks.start_point <-> ${point}`)
    .limit(limit)
    .execute(abortable(signal));

  return rows.map(toRouteSummary);
}

const MAX_SEARCH_TERMS = 5;

/**
 * Loads the routes whose names have every word in `query`, matching each word
 * as a prefix so partial input finds routes as it's typed. Best matches come
 * first.
 */
export async function loadRoutesMatching(
  query: string,
  {
    labelled,
    limit,
    signal,
  }: { labelled: LabelledFilter; limit: number; signal?: AbortSignal },
): Promise<RouteHeadline[]> {
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

  return routeHeadlines(db, labelled)
    .where(sql<boolean>`routes.name_tsv @@ ${tsquery}`)
    .orderBy(sql`ts_rank_cd(routes.name_tsv, ${tsquery})`, "desc")
    .orderBy("routes.sort_at", "desc")
    .limit(limit)
    .execute(abortable(signal));
}

/**
 * Loads a route with its full track, or `null` if it doesn't exist, hasn't
 * been processed yet, or `labelled` filters it out.
 */
export async function loadRoute(
  ref: RouteRef,
  {
    labelled,
    signal = AbortSignal.timeout(CHEAP_QUERY_TIMEOUT_MS),
  }: { labelled: LabelledFilter; signal?: AbortSignal },
): Promise<Route | null> {
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
      >`COALESCE(tracks.elevation_profile, '[]'::jsonb)`.as("elevationProfile"),
    ])
    .where("routes.did", "=", ref.did)
    .where("routes.rkey", "=", ref.rkey)
    .where("routes.tombstoned", "=", false)
    .where("tracks.path", "is not", null)
    .where(matchesLabelled(labelled, "routes.uri", "routes.cid"))
    .executeTakeFirst(abortable(signal));

  if (!row) {
    return null;
  }

  const { pathGeoJson, ...route } = row;
  return { ...route, path: JSON.parse(pathGeoJson) };
}

/** Loads a route's summary, with a simplified track. */
export async function loadRouteSummary(
  ref: RouteRef,
  {
    labelled,
    signal = AbortSignal.timeout(CHEAP_QUERY_TIMEOUT_MS),
  }: { labelled: LabelledFilter; signal?: AbortSignal },
): Promise<RouteSummary | null> {
  const db = await getDb();

  const row = await routeSummaries(db, labelled)
    .where("routes.did", "=", ref.did)
    .where("routes.rkey", "=", ref.rkey)
    .executeTakeFirst(abortable(signal));

  return row ? toRouteSummary(row) : null;
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

export type RouteGpxError = "not-found" | "fetch-failed";

export type RouteGpxResult =
  | { ok: true; name: string; blob: Response }
  | { ok: false; reason: RouteGpxError };

/** Fetches a route's GPX file from its author's PDS. */
export async function fetchRouteGpx(
  ref: RouteRef,
  {
    labelled,
    signal = AbortSignal.timeout(CHEAP_QUERY_TIMEOUT_MS),
  }: { labelled: LabelledFilter; signal?: AbortSignal },
): Promise<RouteGpxResult> {
  const db = await getDb();
  const row = await db
    .selectFrom("routes")
    .select(["name", "gpx_cid as gpxCid"])
    .where("did", "=", ref.did)
    .where("rkey", "=", ref.rkey)
    .where("tombstoned", "=", false)
    .where(matchesLabelled(labelled, "routes.uri", "routes.cid"))
    .executeTakeFirst(abortable(signal));

  if (!row) {
    return { ok: false, reason: "not-found" };
  }

  try {
    return {
      ok: true,
      name: row.name,
      blob: await fetchBlob(ref.did, row.gpxCid),
    };
  } catch (error) {
    logger.warn({ err: error, ...ref }, "routes:gpx");
    return { ok: false, reason: "fetch-failed" };
  }
}

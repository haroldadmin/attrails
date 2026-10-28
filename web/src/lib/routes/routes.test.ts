import { TID } from "@atproto/common-web";
import { sql } from "kysely";
import { describe, expect, test, vi } from "vitest";
import { getDb } from "@/db/client";
import { loadLabelledUris } from "@/lib/moderation";
import { fakeAccount, newCid } from "@/test/atproto";
import { setUpTestDatabase } from "@/test/database";
import {
  createRoute,
  deleteRoute,
  loadRoute,
  loadRoutes,
  loadRoutesMatching,
  loadRoutesNear,
  parseTags,
  ROUTE_MAX_TAGS,
  ROUTE_TAG_MAX_GRAPHEMES,
  routeSchema,
  saveRoute,
} from ".";

// `getDb` waits on Next.js to opt out of prerendering, which needs a request.
vi.mock("next/server", () => ({ connection: async () => {} }));

setUpTestDatabase();

const ALICE = "did:plc:alice";
const BOB = "did:plc:bob";

const RUNNING = "app.attrails.defs#running";
const CYCLING = "app.attrails.defs#cycling";

/** Inserts a route and its processed track as if ingested. */
async function insertRoute(
  author: string,
  {
    name = "Coastal loop",
    activity = RUNNING,
    day = 1,
    start = [0, 0],
    labelled = false,
    tombstoned = false,
    processed = true,
  }: {
    name?: string;
    activity?: string;
    day?: number;
    start?: [lon: number, lat: number];
    labelled?: boolean;
    tombstoned?: boolean;
    processed?: boolean;
  } = {},
) {
  const rkey = TID.nextStr();
  const uri = `at://${author}/app.attrails.route/${rkey}`;
  const cid = await newCid();
  const gpxCid = await newCid();
  const at = sql<Temporal.Instant>`${"2026-01-01T00:00:00Z"}::timestamptz + make_interval(days => ${day})`;

  const db = await getDb();
  await db
    .insertInto("routes")
    .values({
      uri,
      cid,
      did: author,
      rkey,
      name,
      description: null,
      activity,
      surface: null,
      difficulty: null,
      tags: [],
      images: JSON.stringify([]),
      details: JSON.stringify({}),
      sort_at: at,
      created_at: at,
      ingested_at: at,
      tombstoned,
      gpx_cid: gpxCid,
    })
    .execute();

  const [lon, lat] = start;
  await db
    .insertInto("tracks")
    .values({
      cid: gpxCid,
      parser_version: 1,
      distance_m: 1500,
      point_count: 2,
      is_loop: false,
      start_point: sql<string>`ST_GeogFromText(${`POINT(${lon} ${lat})`})`,
      end_point: sql<string>`ST_GeogFromText(${`POINT(${lon + 0.01} ${lat + 0.01})`})`,
      path: processed
        ? sql<string>`ST_GeogFromText(${`MULTILINESTRING((${lon} ${lat}, ${lon + 0.01} ${lat + 0.01}))`})`
        : null,
      processed_at: sql<Temporal.Instant>`now()`,
    })
    .execute();

  if (labelled) {
    await db
      .insertInto("labels")
      .values({
        uri,
        cid,
        val: "spam",
        cts: sql<Temporal.Instant>`now()`,
        source: "test",
      })
      .execute();
  }

  return { uri, cid, did: author, rkey };
}

describe("loading routes", () => {
  test("pages through listed routes newest first, by activity or author", async () => {
    const first = await insertRoute(ALICE, { day: 1 });
    const second = await insertRoute(ALICE, { day: 2 });
    const third = await insertRoute(ALICE, { day: 3 });
    const cycling = await insertRoute(BOB, { day: 4, activity: CYCLING });
    await insertRoute(ALICE, { day: 5, tombstoned: true });
    await insertRoute(ALICE, { day: 6, processed: false });

    const loaded: string[] = [];
    let cursor: string | undefined;
    do {
      const page = await loadRoutes({
        activity: RUNNING,
        labelled: "include",
        cursor,
        limit: 2,
      });
      loaded.push(...page.items.map(({ uri }) => uri));
      cursor = page.nextCursor ?? undefined;
    } while (cursor);

    expect(loaded).toEqual([third.uri, second.uri, first.uri]);

    const bobs = await loadRoutes({
      author: BOB,
      labelled: "include",
      limit: 10,
    });
    expect(bobs.items.map(({ uri }) => uri)).toEqual([cycling.uri]);
  });

  test("filters by moderation labels", async () => {
    const labelled = await insertRoute(ALICE, { labelled: true });
    const clean = await insertRoute(BOB);

    const listed = await loadRoutes({ labelled: "exclude", limit: 10 });
    expect(listed.items.map(({ uri }) => uri)).toEqual([clean.uri]);

    expect(await loadRoute(labelled, { labelled: "exclude" })).toBeNull();
    const route = await loadRoute(labelled, { labelled: "include" });
    expect(route).toMatchObject({
      uri: labelled.uri,
      path: { type: "MultiLineString" },
      elevationProfile: [],
    });
    expect(await loadLabelledUris([route!])).toEqual(new Set([labelled.uri]));
  });

  test("finds routes that start nearby, nearest first", async () => {
    const near = await insertRoute(ALICE, { start: [0.01, 0] });
    const nearest = await insertRoute(ALICE, { start: [0, 0] });
    await insertRoute(ALICE, { start: [1, 0] });

    const routes = await loadRoutesNear(
      { latitude: 0, longitude: 0 },
      { radiusM: 5_000, labelled: "include", limit: 10 },
    );

    expect(routes.map(({ uri }) => uri)).toEqual([nearest.uri, near.uri]);
  });

  test("searches names by the prefixes of every word", async () => {
    const coastalLoop = await insertRoute(ALICE, { name: "Coastal loop" });
    const coastToCoast = await insertRoute(ALICE, { name: "Coast to coast" });
    await insertRoute(ALICE, { name: "Hill climb" });

    const search = async (query: string) =>
      (await loadRoutesMatching(query, { labelled: "include", limit: 10 }))
        .map(({ uri }) => uri)
        .sort();

    expect(await search("coa lo")).toEqual([coastalLoop.uri]);
    expect(await search("coast")).toEqual(
      [coastalLoop.uri, coastToCoast.uri].sort(),
    );
    expect(await search("&|!")).toEqual([]);
  });
});

describe("validating routes", () => {
  const values = {
    name: " Coastal loop ",
    description: "",
    activity: RUNNING,
    surface: "",
    difficulty: "",
    tags: "",
  };

  test("leaves out empty optional details", () => {
    expect(routeSchema.parse(values)).toEqual({
      name: "Coastal loop",
      activity: RUNNING,
      description: undefined,
      surface: undefined,
      difficulty: undefined,
      tags: undefined,
    });
  });

  test.each([
    { ...values, name: "  " },
    { ...values, activity: "" },
  ])("rejects %o", (input) => {
    expect(routeSchema.safeParse(input).success).toBe(false);
  });

  test("cleans up comma-separated tags", () => {
    expect(parseTags(" coastal, #Cafe stop,, cafe STOP ,##hills ")).toEqual([
      "coastal",
      "Cafe stop",
      "hills",
    ]);
  });

  test("keeps at most the lexicon's number of tags, without splitting characters", () => {
    const tags = parseTags(
      Array.from({ length: ROUTE_MAX_TAGS + 5 }, (_, i) => `tag ${i}`).join(),
    );
    expect(tags).toHaveLength(ROUTE_MAX_TAGS);

    const [tag] = parseTags("🏔️".repeat(ROUTE_TAG_MAX_GRAPHEMES + 10));
    expect(tag).toBe("🏔️".repeat(ROUTE_TAG_MAX_GRAPHEMES));
  });
});

describe("writing routes", () => {
  const draft = routeSchema.parse({
    name: "Coastal loop",
    description: "",
    activity: RUNNING,
    surface: "",
    difficulty: "",
    tags: "",
  });

  test("uploads the GPX file and creates a route for it", async () => {
    const { agent, writes } = fakeAccount(ALICE);
    const gpx = new TextEncoder().encode("<gpx />");

    const result = await createRoute(agent, draft, gpx);

    expect(result).toMatchObject({ ok: true, ref: { did: ALICE } });
    expect(writes).toEqual([
      { method: "com.atproto.repo.uploadBlob", input: { size: gpx.length } },
      {
        method: "com.atproto.repo.createRecord",
        input: expect.objectContaining({
          record: expect.objectContaining({
            name: "Coastal loop",
            activity: RUNNING,
            track: expect.objectContaining({ mimeType: "application/gpx+xml" }),
          }),
        }),
      },
    ]);
  });

  test("saves over the expected version, keeping the track", async () => {
    const current = {
      $type: "app.attrails.route",
      name: "Coastal loop",
      activity: RUNNING,
      track: {
        $type: "blob",
        ref: { $link: await newCid() },
        mimeType: "application/gpx+xml",
        size: 100,
      },
      createdAt: "2026-01-01T00:00:00.000Z",
    };
    const { agent, writes } = fakeAccount(ALICE, {
      records: { "app.attrails.route": current },
    });

    const result = await saveRoute(
      agent,
      { did: ALICE, rkey: "3l3qo2vutsw2b" },
      { ...draft, name: "Coastal loop (long)" },
      { swapCid: "expected" },
    );

    expect(result).toEqual({ ok: true });
    expect(writes).toEqual([
      {
        method: "com.atproto.repo.putRecord",
        input: expect.objectContaining({
          swapRecord: "expected",
          record: { ...current, name: "Coastal loop (long)" },
        }),
      },
    ]);
  });

  test("refuses to change another account's route", async () => {
    const { agent, writes } = fakeAccount(BOB);
    const ref = { did: ALICE, rkey: "3l3qo2vutsw2b" };

    expect(await saveRoute(agent, ref, draft, { swapCid: "expected" })).toEqual(
      { ok: false, reason: "not-owner" },
    );
    expect(await deleteRoute(agent, ref)).toEqual({
      ok: false,
      reason: "not-owner",
    });
    expect(writes).toEqual([]);
  });
});

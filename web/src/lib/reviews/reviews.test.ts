import { TID } from "@atproto/common-web";
import { type Agent, cidForRawBytes } from "@atproto/lex";
import { sql } from "kysely";
import { describe, expect, test, vi } from "vitest";
import { getDb } from "@/db/client";
import { loadLabelledUris } from "@/lib/moderation";
import { setUpTestDatabase } from "@/test/database";
import {
  deleteReview,
  loadAuthorReviews,
  loadReviewSummary,
  loadReviews,
  loadViewerReview,
  reviewSchema,
  saveReview,
  type Subject,
} from ".";

// `getDb` waits on Next.js to opt out of prerendering, which needs a request.
vi.mock("next/server", () => ({ connection: async () => {} }));

setUpTestDatabase();

const ROUTE_AUTHOR = "did:plc:routeauthor";
const ALICE = "did:plc:alice";
const BOB = "did:plc:bob";

async function newCid(): Promise<string> {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return (await cidForRawBytes(bytes)).toString();
}

async function routeSubject(
  rkey: string,
  author = ROUTE_AUTHOR,
): Promise<Subject> {
  return {
    uri: `at://${author}/app.attrails.route/${rkey}`,
    cid: await newCid(),
  };
}

/** Inserts a review as if ingested from `author`'s repository. */
async function insertReview(
  author: string,
  subject: Subject,
  {
    day,
    rating = 3,
    labelled = false,
    tombstoned = false,
  }: { day: number; rating?: number; labelled?: boolean; tombstoned?: boolean },
) {
  const rkey = TID.nextStr();
  const uri = `at://${author}/app.attrails.review/${rkey}`;
  const cid = await newCid();
  const at = sql<Temporal.Instant>`${`2026-01-01T00:00:00Z`}::timestamptz + make_interval(days => ${day})`;

  const db = await getDb();
  await db
    .insertInto("reviews")
    .values({
      uri,
      cid,
      did: author,
      rkey,
      subject_uri: subject.uri,
      subject_cid: subject.cid,
      rating,
      body: "Lovely views.",
      images: JSON.stringify([]),
      sort_at: at,
      created_at: at,
      ingested_at: at,
      tombstoned,
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

  return { uri, rkey };
}

/** An account whose repository records the writes made to it. */
function fakeAccount(did: string) {
  const writes: { method: string; rkey?: string }[] = [];

  const agent: Agent = {
    did: did as Agent["did"],
    async fetchHandler(path, init) {
      const method = path.replace(/^\/xrpc\//, "").split("?")[0];
      const body =
        typeof init.body === "string"
          ? JSON.parse(init.body)
          : JSON.parse(new TextDecoder().decode(init.body as Uint8Array));
      writes.push({ method, rkey: body.rkey });

      const rkey = body.rkey ?? "created";
      return Response.json({
        uri: `at://${did}/${body.collection}/${rkey}`,
        cid: await newCid(),
      });
    },
  };

  return { agent, writes };
}

describe("loading reviews", () => {
  test("counts each account's newest review, never the subject author's own", async () => {
    const subject = await routeSubject("coast");
    await insertReview(ALICE, subject, { day: 1, rating: 1 });
    await insertReview(ALICE, subject, { day: 2, rating: 4 });
    await insertReview(BOB, subject, { day: 3, rating: 5 });
    await insertReview(ROUTE_AUTHOR, subject, { day: 4, rating: 1 });
    await insertReview("did:plc:carol", subject, {
      day: 5,
      rating: 1,
      tombstoned: true,
    });

    const reviews = await loadReviews(subject, {
      labelled: "include",
      limit: 10,
    });
    expect(reviews.map(({ author, rating }) => [author, rating])).toEqual([
      [BOB, 5],
      [ALICE, 4],
    ]);

    expect(await loadReviewSummary(subject, { labelled: "include" })).toEqual({
      count: 2,
      averageRating: 4.5,
    });
  });

  test("filters by moderation labels on the newest review", async () => {
    const subject = await routeSubject("hills");
    await insertReview(ALICE, subject, { day: 1 });
    const labelled = await insertReview(ALICE, subject, {
      day: 2,
      labelled: true,
    });
    const clean = await insertReview(BOB, subject, { day: 3 });

    const load = (filter: "include" | "exclude" | "only") =>
      loadReviews(subject, { labelled: filter, limit: 10 });

    // Alice's older, unlabelled review doesn't stand in for her newest one.
    expect((await load("exclude")).map(({ uri }) => uri)).toEqual([clean.uri]);
    expect((await load("only")).map(({ uri }) => uri)).toEqual([labelled.uri]);

    const all = await load("include");
    expect(all).toHaveLength(2);
    expect(await loadLabelledUris(all)).toEqual(new Set([labelled.uri]));

    expect(
      await loadViewerReview(subject, { did: ALICE }, { labelled: "exclude" }),
    ).toBeNull();
    expect(
      await loadViewerReview(subject, null, { labelled: "include" }),
    ).toBeNull();
  });

  test("pages through an account's reviews, newest first", async () => {
    const uris: string[] = [];
    for (let day = 1; day <= 5; day++) {
      uris.unshift(
        (await insertReview(ALICE, await routeSubject(`r${day}`), { day })).uri,
      );
    }
    await insertReview(ALICE, await routeSubject("own", ALICE), { day: 6 });

    const loaded: string[] = [];
    let cursor: string | undefined;
    do {
      const page = await loadAuthorReviews(ALICE, {
        labelled: "include",
        cursor,
        limit: 2,
      });
      loaded.push(...page.items.map(({ uri }) => uri));
      cursor = page.nextCursor ?? undefined;
    } while (cursor);

    expect(loaded).toEqual(uris);
  });
});

describe("validating reviews", () => {
  test("accepts a rating from 1 to 5 with some text", () => {
    expect(
      reviewSchema.parse({ rating: "4", text: "  Great climb. " }),
    ).toEqual({ rating: 4, text: "Great climb." });
  });

  test.each([
    { rating: "", text: "Great climb." },
    { rating: "6", text: "Great climb." },
    { rating: "2.5", text: "Great climb." },
    { rating: "4", text: "   " },
    { rating: "4", text: "🏔️".repeat(3001) },
  ])("rejects %o", (input) => {
    expect(reviewSchema.safeParse(input).success).toBe(false);
  });

  test("counts characters as people see them", () => {
    const text = "🏔️".repeat(3000);
    expect(reviewSchema.safeParse({ rating: 4, text }).success).toBe(true);
  });
});

describe("writing reviews", () => {
  const draft = { rating: 5, text: "Worth the climb." };

  test("creates a review, then replaces the newest one", async () => {
    const subject = await routeSubject("valley");
    const { agent, writes } = fakeAccount(ALICE);

    expect(await saveReview(agent, subject, draft)).toEqual({
      ok: true,
      outcome: "created",
    });

    await insertReview(ALICE, subject, { day: 1 });
    const newest = await insertReview(ALICE, subject, { day: 2 });
    expect(await saveReview(agent, subject, draft)).toEqual({
      ok: true,
      outcome: "updated",
    });

    expect(writes).toEqual([
      { method: "com.atproto.repo.createRecord", rkey: undefined },
      { method: "com.atproto.repo.putRecord", rkey: newest.rkey },
    ]);
  });

  test("refuses to review the account's own record", async () => {
    const { agent, writes } = fakeAccount(ROUTE_AUTHOR);

    expect(await saveReview(agent, await routeSubject("mine"), draft)).toEqual({
      ok: false,
      reason: "self-review",
    });
    expect(writes).toEqual([]);
  });

  test("deletes the newest review", async () => {
    const subject = await routeSubject("ridge");
    const { agent, writes } = fakeAccount(ALICE);

    expect(await deleteReview(agent, subject)).toEqual({
      ok: false,
      reason: "not-found",
    });

    await insertReview(ALICE, subject, { day: 1 });
    const newest = await insertReview(ALICE, subject, { day: 2 });
    expect(await deleteReview(agent, subject)).toEqual({ ok: true });
    expect(writes).toEqual([
      { method: "com.atproto.repo.deleteRecord", rkey: newest.rkey },
    ]);
  });
});

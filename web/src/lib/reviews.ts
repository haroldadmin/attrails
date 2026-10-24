import "server-only";

import { sql } from "kysely";
import { cache } from "react";
import { type AttrailsDb, getDb } from "@/db/client";
import { isLabelled } from "@/lib/moderation";
import type { Page } from "@/lib/pages";
import { after, decodeCursor, toPage } from "./pagination";

export type Review = {
  did: string;
  rkey: string;
  rating: number;
  text: string | null;
  createdAt: Temporal.Instant;
  /** Whether this version of the review has moderation labels. */
  labelled: boolean;
};

export type ReviewSummary = {
  count: number;
  /** `null` if the route has no reviews. */
  averageRating: number | null;
};

// An account can keep several reviews of the same route in its repository.
// Only the newest one counts, and authors can't review their own routes.
function latestReviews(db: AttrailsDb, routeUri: string) {
  return db
    .selectFrom("reviews")
    .innerJoin("routes", "routes.uri", "reviews.subject_uri")
    .distinctOn("reviews.did")
    .select([
      "reviews.uri",
      "reviews.cid",
      "reviews.did",
      "reviews.rkey",
      "reviews.rating",
      "reviews.body as text",
      "reviews.created_at as createdAt",
      "reviews.sort_at as sortAt",
    ])
    .where("reviews.subject_uri", "=", routeUri)
    .where("reviews.tombstoned", "=", false)
    .whereRef("reviews.did", "<>", "routes.did")
    .orderBy("reviews.did")
    .orderBy("reviews.created_at", "desc")
    .orderBy("reviews.rkey", "desc");
}

/**
 * Summarises a route's reviews, leaving out reviews with moderation labels.
 */
export const fetchReviewSummary = cache(
  async (routeUri: string): Promise<ReviewSummary> => {
    const db = await getDb();

    return db
      .selectFrom(latestReviews(db, routeUri).as("latest"))
      .where((eb) => eb.not(isLabelled("latest.uri", "latest.cid")))
      .select([
        sql<number>`COUNT(*)::int`.as("count"),
        sql<number | null>`AVG(rating)::float8`.as("averageRating"),
      ])
      .executeTakeFirstOrThrow();
  },
);

/**
 * Fetches a route's reviews, newest first. Reviews with moderation labels are
 * left out, unless `viewerDid` wrote them.
 */
export async function fetchReviews(
  routeUri: string,
  { limit = 10, viewerDid }: { limit?: number; viewerDid?: string },
): Promise<Review[]> {
  const db = await getDb();

  return db
    .selectFrom(latestReviews(db, routeUri).as("latest"))
    .where((eb) => {
      const unlabelled = eb.not(isLabelled("latest.uri", "latest.cid"));
      return viewerDid
        ? eb.or([unlabelled, eb("latest.did", "=", viewerDid)])
        : unlabelled;
    })
    .select([
      "did",
      "rkey",
      "rating",
      "text",
      "createdAt",
      isLabelled("latest.uri", "latest.cid").as("labelled"),
    ])
    .orderBy("sortAt", "desc")
    .limit(limit)
    .execute();
}

/**
 * Fetches `did`'s newest review of a route, or `null` if they haven't
 * reviewed it.
 */
export async function fetchUserReview(
  routeUri: string,
  did: string,
): Promise<Review | null> {
  const db = await getDb();

  const row = await db
    .selectFrom("reviews")
    .select([
      "did",
      "rkey",
      "rating",
      "body as text",
      "created_at as createdAt",
      isLabelled("reviews.uri", "reviews.cid").as("labelled"),
    ])
    .where("subject_uri", "=", routeUri)
    .where("did", "=", did)
    .where("tombstoned", "=", false)
    .orderBy("created_at", "desc")
    .orderBy("rkey", "desc")
    .executeTakeFirst();

  return row ?? null;
}

export type AuthoredReview = Review & {
  route: { did: string; rkey: string; name: string };
};

/**
 * Fetches a page of `did`'s reviews, newest first. Like on a route's page,
 * only the newest review of each route counts.
 */
export async function fetchReviewsByAuthor(
  did: string,
  { cursor, limit }: { cursor?: string; limit: number },
): Promise<Page<AuthoredReview>> {
  const db = await getDb();
  const position = cursor ? decodeCursor(cursor) : undefined;
  if (position === null) {
    return { items: [], nextCursor: null };
  }

  const latest = db
    .selectFrom("reviews")
    .innerJoin("routes", "routes.uri", "reviews.subject_uri")
    .distinctOn("reviews.subject_uri")
    .select([
      "reviews.did",
      "reviews.rkey",
      "reviews.rating",
      "reviews.body as text",
      "reviews.created_at as createdAt",
      "reviews.sort_at as sortAt",
      isLabelled("reviews.uri", "reviews.cid").as("labelled"),
      "routes.did as routeDid",
      "routes.rkey as routeRkey",
      "routes.name as routeName",
    ])
    .where("reviews.did", "=", did)
    .where("reviews.tombstoned", "=", false)
    .where("routes.tombstoned", "=", false)
    .where("routes.did", "<>", did)
    .orderBy("reviews.subject_uri")
    .orderBy("reviews.created_at", "desc")
    .orderBy("reviews.rkey", "desc");

  let query = db.selectFrom(latest.as("latest")).selectAll();
  if (position) {
    query = query.where(after("sortAt", "rkey", position));
  }

  const rows = await query
    .orderBy("sortAt", "desc")
    .orderBy("rkey", "desc")
    .limit(limit + 1)
    .execute();

  const page = toPage(rows, limit, ({ sortAt, rkey }) => ({ sortAt, rkey }));
  return {
    ...page,
    items: page.items.map((row) => ({
      did: row.did,
      rkey: row.rkey,
      rating: row.rating,
      text: row.text,
      createdAt: row.createdAt,
      labelled: row.labelled,
      route: { did: row.routeDid, rkey: row.routeRkey, name: row.routeName },
    })),
  };
}

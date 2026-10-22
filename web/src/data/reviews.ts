import "server-only";

import { sql } from "kysely";
import { cache } from "react";
import { type AttrailsDb, getDb } from "@/db/client";

export type Review = {
  did: string;
  rkey: string;
  rating: number;
  text: string | null;
  createdAt: Temporal.Instant;
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

export const fetchReviewSummary = cache(
  async (routeUri: string): Promise<ReviewSummary> => {
    const db = await getDb();

    return db
      .selectFrom(latestReviews(db, routeUri).as("latest"))
      .select([
        sql<number>`COUNT(*)::int`.as("count"),
        sql<number | null>`AVG(rating)::float8`.as("averageRating"),
      ])
      .executeTakeFirstOrThrow();
  },
);

/**
 * Fetches a route's reviews, newest first.
 */
export async function fetchReviews(
  routeUri: string,
  { limit = 10 }: { limit?: number },
): Promise<Review[]> {
  const db = await getDb();

  return db
    .selectFrom(latestReviews(db, routeUri).as("latest"))
    .select(["did", "rkey", "rating", "text", "createdAt"])
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
    ])
    .where("subject_uri", "=", routeUri)
    .where("did", "=", did)
    .where("tombstoned", "=", false)
    .orderBy("created_at", "desc")
    .orderBy("rkey", "desc")
    .executeTakeFirst();

  return row ?? null;
}

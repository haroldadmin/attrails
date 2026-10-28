import "server-only";

import { AtUri } from "@atproto/syntax";
import { sql } from "kysely";
import {
  abortable,
  type AttrailsDb,
  CHEAP_QUERY_TIMEOUT_MS,
  getDb,
} from "@/db/client";
import type { Viewer } from "@/lib/identity";
import { type LabelledFilter, matchesLabelled } from "@/lib/moderation";
import type { Page } from "@/lib/pages";
import { after, decodeCursor, toPage } from "@/lib/pagination";
import type { AuthoredReview, Review, ReviewSummary, Subject } from "./shared";

type SubjectUri = Pick<Subject, "uri">;

const REVIEW_COLUMNS = [
  "reviews.uri",
  "reviews.cid",
  "reviews.did as author",
  "reviews.rkey",
  "reviews.rating",
  "reviews.body as text",
  "reviews.created_at as createdAt",
  "reviews.sort_at as sortAt",
] as const;

// An account can keep several reviews of the same subject in its repository.
// Only the newest one counts, so labels are filtered after picking it: an older
// version never stands in for a newest one that's filtered out.
//
// Authors can't review their own records, and the subject's author is the
// account in its URI.
function latestReviews(db: AttrailsDb, subject: SubjectUri) {
  return db
    .selectFrom("reviews")
    .distinctOn("reviews.did")
    .select(REVIEW_COLUMNS)
    .where("reviews.subject_uri", "=", subject.uri)
    .where("reviews.tombstoned", "=", false)
    .where("reviews.did", "<>", new AtUri(subject.uri).hostname)
    .orderBy("reviews.did")
    .orderBy("reviews.created_at", "desc")
    .orderBy("reviews.rkey", "desc");
}

/** Loads the newest review of `subject` by each account, newest first. */
export async function loadReviews(
  subject: SubjectUri,
  {
    labelled,
    limit,
    signal,
  }: { labelled: LabelledFilter; limit: number; signal?: AbortSignal },
): Promise<Review[]> {
  const db = await getDb();

  return db
    .selectFrom(latestReviews(db, subject).as("latest"))
    .select(["uri", "cid", "author", "rating", "text", "createdAt"])
    .where(matchesLabelled(labelled, "latest.uri", "latest.cid"))
    .orderBy("sortAt", "desc")
    .orderBy("author", "desc")
    .limit(limit)
    .execute(abortable(signal));
}

/** Summarises the ratings of the reviews `loadReviews` would load. */
export async function loadReviewSummary(
  subject: SubjectUri,
  { labelled, signal }: { labelled: LabelledFilter; signal?: AbortSignal },
): Promise<ReviewSummary> {
  const db = await getDb();

  const [summary] = await db
    .selectFrom(latestReviews(db, subject).as("latest"))
    .select([
      sql<number>`COUNT(*)::int`.as("count"),
      sql<number | null>`AVG(rating)::float8`.as("averageRating"),
    ])
    .where(matchesLabelled(labelled, "latest.uri", "latest.cid"))
    .execute(abortable(signal));
  return summary;
}

/**
 * Loads the viewer's newest review of `subject`, or `null` if they're signed
 * out, haven't reviewed it, or `labelled` filters it out.
 */
export async function loadViewerReview(
  subject: SubjectUri,
  viewer: Viewer,
  {
    labelled,
    signal = AbortSignal.timeout(CHEAP_QUERY_TIMEOUT_MS),
  }: { labelled: LabelledFilter; signal?: AbortSignal },
): Promise<Review | null> {
  if (!viewer) {
    return null;
  }

  const db = await getDb();
  const latest = db
    .selectFrom("reviews")
    .select(REVIEW_COLUMNS)
    .where("reviews.subject_uri", "=", subject.uri)
    .where("reviews.did", "=", viewer.did)
    .where("reviews.tombstoned", "=", false)
    .orderBy("reviews.created_at", "desc")
    .orderBy("reviews.rkey", "desc")
    .limit(1);

  const row = await db
    .selectFrom(latest.as("latest"))
    .select(["uri", "cid", "author", "rating", "text", "createdAt"])
    .where(matchesLabelled(labelled, "latest.uri", "latest.cid"))
    .executeTakeFirst(abortable(signal));

  return row ?? null;
}

/**
 * Loads a page of `author`'s reviews, newest first. Like for a subject, only
 * the newest review of each subject counts, and reviews of the author's own
 * records are left out.
 */
export async function loadAuthorReviews(
  author: string,
  {
    labelled,
    cursor,
    limit,
    signal,
  }: {
    labelled: LabelledFilter;
    cursor?: string;
    limit: number;
    signal?: AbortSignal;
  },
): Promise<Page<AuthoredReview>> {
  const position = cursor ? decodeCursor(cursor) : undefined;
  if (position === null) {
    return { items: [], nextCursor: null };
  }

  const db = await getDb();
  const latest = db
    .selectFrom("reviews")
    .distinctOn("reviews.subject_uri")
    .select([
      ...REVIEW_COLUMNS,
      "reviews.subject_uri as subjectUri",
      "reviews.subject_cid as subjectCid",
    ])
    .where("reviews.did", "=", author)
    .where("reviews.tombstoned", "=", false)
    .where(
      sql<boolean>`NOT starts_with(reviews.subject_uri, ${`at://${author}/`})`,
    )
    .orderBy("reviews.subject_uri")
    .orderBy("reviews.created_at", "desc")
    .orderBy("reviews.rkey", "desc");

  let query = db
    .selectFrom(latest.as("latest"))
    .selectAll()
    .where(matchesLabelled(labelled, "latest.uri", "latest.cid"));
  if (position) {
    query = query.where(after("sortAt", "author", "rkey", position));
  }

  const rows = await query
    .orderBy("sortAt", "desc")
    .orderBy("author", "desc")
    .orderBy("rkey", "desc")
    .limit(limit + 1)
    .execute(abortable(signal));

  const page = toPage(rows, limit, ({ sortAt, author, rkey }) => ({
    sortAt,
    did: author,
    rkey,
  }));
  return {
    ...page,
    items: page.items.map((row) => ({
      uri: row.uri,
      cid: row.cid,
      author: row.author,
      rating: row.rating,
      text: row.text,
      createdAt: row.createdAt,
      subject: { uri: row.subjectUri, cid: row.subjectCid },
    })),
  };
}

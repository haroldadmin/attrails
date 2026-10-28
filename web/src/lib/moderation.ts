import "server-only";

import { type RawBuilder, sql } from "kysely";
import { abortable, CHEAP_QUERY_TIMEOUT_MS, getDb } from "@/db/client";

/**
 * Which records to keep based on their moderation labels: all of them, only
 * those without labels, or only those with labels.
 */
export type LabelledFilter = "include" | "exclude" | "only";

/**
 * Whether the version of a record identified by the `uri` and `cid` columns
 * has any moderation labels. Only negative labels are stored, so any label
 * counts. Qualify the column names with their table, so they aren't resolved
 * against `labels`.
 */
export function isLabelled(uri: string, cid: string): RawBuilder<boolean> {
  return sql<boolean>`EXISTS (
    SELECT 1 FROM labels
    WHERE labels.uri = ${sql.ref(uri)} AND labels.cid = ${sql.ref(cid)}
  )`;
}

/**
 * Matches the records identified by the `uri` and `cid` columns that `filter`
 * keeps. Qualify the column names like for `isLabelled`.
 */
export function matchesLabelled(
  filter: LabelledFilter,
  uri: string,
  cid: string,
): RawBuilder<boolean> {
  switch (filter) {
    case "include":
      return sql<boolean>`TRUE`;
    case "exclude":
      return sql<boolean>`NOT ${isLabelled(uri, cid)}`;
    case "only":
      return isLabelled(uri, cid);
  }
}

/**
 * Loads which of `records` have moderation labels on the given version,
 * returned as a set of their URIs.
 */
export async function loadLabelledUris(
  records: readonly { uri: string; cid: string }[],
  {
    signal = AbortSignal.timeout(CHEAP_QUERY_TIMEOUT_MS),
  }: { signal?: AbortSignal } = {},
): Promise<Set<string>> {
  if (records.length === 0) {
    return new Set();
  }

  const db = await getDb();
  const rows = await db
    .selectFrom("labels")
    .select("uri")
    .distinct()
    .where((eb) =>
      eb(
        eb.refTuple("uri", "cid"),
        "in",
        records.map(({ uri, cid }) => eb.tuple(uri, cid)),
      ),
    )
    .execute(abortable(signal));

  return new Set(rows.map((row) => row.uri));
}

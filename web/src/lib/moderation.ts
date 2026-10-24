import "server-only";

import { type RawBuilder, sql } from "kysely";

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

import "server-only";

import { type RawBuilder, sql } from "kysely";
import type { Page } from "@/lib/pages";

type Position = {
  sortAt: Temporal.Instant;
  did: string;
  rkey: string;
};

/**
 * Pages through records, newest first. The DID breaks ties between records
 * from different accounts, and the record key between records with the same
 * timestamp and author.
 */
function encodeCursor({ sortAt, did, rkey }: Position): string {
  return Buffer.from(
    JSON.stringify({ sortAt: sortAt.toString(), did, rkey }),
  ).toString("base64url");
}

export function decodeCursor(cursor: string): Position | null {
  try {
    const decoded: unknown = JSON.parse(
      Buffer.from(cursor, "base64url").toString("utf8"),
    );
    if (typeof decoded !== "object" || decoded === null) {
      return null;
    }

    const { sortAt, did, rkey } = decoded as Record<string, unknown>;
    if (
      typeof sortAt !== "string" ||
      typeof did !== "string" ||
      typeof rkey !== "string"
    ) {
      return null;
    }

    return { sortAt: Temporal.Instant.from(sortAt), did, rkey };
  } catch {
    return null;
  }
}

/** Matches rows that come after `position` in newest-first order. */
export function after(
  sortAtColumn: string,
  didColumn: string,
  rkeyColumn: string,
  position: Position,
): RawBuilder<boolean> {
  return sql<boolean>`(${sql.ref(sortAtColumn)}, ${sql.ref(didColumn)}, ${sql.ref(rkeyColumn)}) < (${position.sortAt.toString()}::timestamptz, ${position.did}, ${position.rkey})`;
}

/**
 * Turns rows fetched with a limit of `limit + 1` into a page. The extra row
 * only tells us whether there's another page.
 */
export function toPage<T>(
  rows: T[],
  limit: number,
  positionOf: (row: T) => Position,
): Page<T> {
  const items = rows.slice(0, limit);
  const last = items.at(-1);
  return {
    items,
    nextCursor:
      rows.length > limit && last ? encodeCursor(positionOf(last)) : null,
  };
}

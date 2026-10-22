import "server-only";

import { type RawBuilder, sql } from "kysely";
import type { Page } from "@/lib/pages";

type Position = {
  sortAt: Temporal.Instant;
  rkey: string;
};

/**
 * Pages through one account's records, newest first. Within an account, the
 * record key breaks ties between records with the same timestamp.
 */
export function encodeCursor({ sortAt, rkey }: Position): string {
  return `${sortAt.toString()}_${rkey}`;
}

export function decodeCursor(cursor: string): Position | null {
  const [sortAt, rkey] = cursor.split("_");
  if (!sortAt || !rkey) {
    return null;
  }

  try {
    return { sortAt: Temporal.Instant.from(sortAt), rkey };
  } catch {
    return null;
  }
}

/** Matches rows that come after `position` in newest-first order. */
export function after(
  sortAtColumn: string,
  rkeyColumn: string,
  position: Position,
): RawBuilder<boolean> {
  return sql<boolean>`(${sql.ref(sortAtColumn)}, ${sql.ref(rkeyColumn)}) < (${position.sortAt.toString()}::timestamptz, ${position.rkey})`;
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

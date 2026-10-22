export type Page<T> = {
  items: T[];
  /** `null` on the last page. */
  nextCursor: string | null;
};

/**
 * Yields the pages that follow `cursor`, loading each one only when it's
 * asked for.
 */
export async function* pagesAfter<T>(
  cursor: string | null,
  load: (cursor: string) => Promise<Page<T>>,
): AsyncGenerator<T[]> {
  while (cursor) {
    const page = await load(cursor);
    yield page.items;
    cursor = page.nextCursor;
  }
}

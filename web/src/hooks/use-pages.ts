import { useCallback, useState } from "react";
import type { Page } from "@/lib/pages";

/**
 * Collects the items of `firstPage` and each page after it, loading the next
 * page on `loadMore()`.
 */
export function usePages<T>(
  firstPage: Page<T>,
  load: (cursor: string) => Promise<Page<T>>,
) {
  const [items, setItems] = useState(firstPage.items);
  const [cursor, setCursor] = useState(firstPage.nextCursor);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);

  const loadMore = useCallback(async () => {
    if (cursor === null) {
      return;
    }

    setLoading(true);
    try {
      const page = await load(cursor);
      setItems((items) => [...items, ...page.items]);
      setCursor(page.nextCursor);
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }, [cursor, load]);

  return {
    items,
    loadMore,
    hasMore: cursor !== null && !failed,
    loading,
    failed,
  };
}

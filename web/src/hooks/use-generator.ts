import { useCallback, useState } from "react";

/**
 * Collects the items an async generator yields, one batch per `generate()`.
 */
export function useGenerator<T>(
  createGenerator: () => AsyncGenerator<T[]>,
  initialItems: T[] = [],
) {
  const [generator] = useState(createGenerator);
  const [items, setItems] = useState(initialItems);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);

  const generate = useCallback(async () => {
    setLoading(true);
    try {
      const next = await generator.next();
      if (next.done) {
        setHasMore(false);
      } else {
        setItems((items) => [...items, ...next.value]);
      }
    } catch {
      // A generator that threw is finished, so there's nothing more to get.
      setFailed(true);
      setHasMore(false);
    } finally {
      setLoading(false);
    }
  }, [generator]);

  return { items, generate, hasMore, loading, failed };
}

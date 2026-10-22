"use client";

import { useEffect, useRef } from "react";

export type LoadOnScrollProps = {
  onLoad: () => void;
  loading: boolean;
  /** Announced while loading, e.g. "Loading more routes…". */
  loadingLabel: string;
};

/**
 * Calls `onLoad` when the reader scrolls near it. Place it after a list.
 */
export function LoadOnScroll({
  onLoad,
  loading,
  loadingLabel,
}: LoadOnScrollProps) {
  const ref = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    const target = ref.current;
    if (!target || loading) {
      return;
    }

    // A new observer reports straight away, so a page too short to fill the
    // screen still leads to the next one.
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          observer.disconnect();
          onLoad();
        }
      },
      { rootMargin: "400px" },
    );

    observer.observe(target);
    return () => observer.disconnect();
  }, [onLoad, loading]);

  return (
    <p ref={ref} role="status" className="text-base-content/70">
      {loading && loadingLabel}
    </p>
  );
}

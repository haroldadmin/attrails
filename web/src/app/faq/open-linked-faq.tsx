"use client";

import { useEffect } from "react";

/**
 * Opens the question a link points to, as in `/faq#<id>`. Not every browser
 * opens a `<details>` element when it's the target of a link.
 */
export function OpenLinkedFaq() {
  useEffect(() => {
    function openTarget() {
      const target = document.getElementById(
        decodeURIComponent(location.hash.slice(1)),
      );
      if (target instanceof HTMLDetailsElement) {
        target.open = true;
        target.scrollIntoView();
      }
    }

    openTarget();
    window.addEventListener("hashchange", openTarget);
    return () => window.removeEventListener("hashchange", openTarget);
  }, []);

  return null;
}

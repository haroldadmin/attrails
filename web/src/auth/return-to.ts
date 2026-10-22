import "server-only";

import { getWebUrl } from "./client";

/**
 * Returns `value` if it's a path on this site, so it's safe to redirect to.
 * Anything else, like `//evil.example`, would make us an open redirect.
 */
export function safeReturnTo(value: unknown): string | undefined {
  if (typeof value !== "string" || !value.startsWith("/")) {
    return undefined;
  }

  const webUrl = getWebUrl();
  try {
    const url = new URL(value, webUrl);
    const path = url.pathname + url.search + url.hash;
    // Normalising can turn `/..//evil.example` into `//evil.example`.
    return url.origin === webUrl.origin && !path.startsWith("//")
      ? path
      : undefined;
  } catch {
    return undefined;
  }
}

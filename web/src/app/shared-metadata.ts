import type { Metadata } from "next";

// Pages that set their own `openGraph` replace the layout's, so they spread
// these in to keep them.
export const openGraphDefaults = {
  siteName: "ATTrails",
  type: "website",
} satisfies Metadata["openGraph"];

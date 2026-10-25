import type { Metadata } from "next";

// Prerendered pages bake in absolute URLs at build time, when the deployment's
// environment isn't available.
export const SITE_URL = new URL("https://www.attrails.app");

// Pages that set their own `openGraph` replace the layout's, so they spread
// these in to keep them.
export const openGraphDefaults = {
  siteName: "ATTrails",
  type: "website",
} satisfies Metadata["openGraph"];

import type { MetadataRoute } from "next";
import { SITE_URL } from "./shared-metadata";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/routes/new",
        "/routes/search",
        "/routes/*/*/edit",
        "/routes/*/*/review",
        "/routes/*/*/gpx",
        "/users/me",
        "/oauth/",
        "/health/",
      ],
    },
    sitemap: new URL("/sitemap.xml", SITE_URL).href,
  };
}

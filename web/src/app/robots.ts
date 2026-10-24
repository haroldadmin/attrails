import type { MetadataRoute } from "next";

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
    sitemap: "https://www.attrails.app/sitemap.xml",
  };
}

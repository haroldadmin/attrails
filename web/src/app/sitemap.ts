import type { MetadataRoute } from "next";
import { ACTIVITY_FILTERS, activitySlug } from "@/lib/routes";
import { SITE_URL } from "./shared-metadata";

const url = (path: string) => new URL(path, SITE_URL).href;

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: url("/"), changeFrequency: "daily", priority: 1 },
    { url: url("/routes"), changeFrequency: "daily", priority: 0.8 },
    ...ACTIVITY_FILTERS.map(([activity]) => ({
      url: url(`/routes?activity=${activitySlug(activity)}`),
      changeFrequency: "daily" as const,
      priority: 0.8,
    })),
    { url: url("/about"), changeFrequency: "monthly", priority: 0.5 },
    { url: url("/moderation"), changeFrequency: "monthly", priority: 0.5 },
    { url: url("/privacy"), changeFrequency: "yearly", priority: 0.3 },
    { url: url("/terms"), changeFrequency: "yearly", priority: 0.3 },
  ];
}

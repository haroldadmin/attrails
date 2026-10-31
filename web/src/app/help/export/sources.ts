// Apps with a guide to exporting a GPX file for ATTrails, each at
// `/help/export/<slug>`.
export const EXPORT_SOURCES = [
  { slug: "strava", name: "Strava" },
  { slug: "komoot", name: "Komoot" },
  { slug: "alltrails", name: "AllTrails" },
] as const;

export type ExportSource = (typeof EXPORT_SOURCES)[number];

export function exportGuideHref({ slug }: ExportSource): string {
  return `/help/export/${slug}`;
}

// Safe to import from client components. Server code imports `@/lib/routes`.

import type { LineString, MultiLineString } from "geojson";
import { z } from "zod";
import { graphemeCount } from "@/lib/text";

export type RouteRef = { did: string; rkey: string };

/** What lists and search results show about a route. */
export type RouteHeadline = RouteRef & {
  uri: string;
  name: string;
  /** Lexicon token, e.g. `app.attrails.defs#cycling`. */
  activity: string;
  uploadedAt: Temporal.Instant;
  distanceM: number;
};

/** What route cards and link previews show, with a simplified track. */
export type RouteSummary = RouteHeadline & {
  elevationGainM: number | null;
  isLoop: boolean;
  /** Simplified track geometry in WGS 84 (lon, lat). */
  path: LineString | MultiLineString;
};

export type ElevationSample = [distanceM: number, elevationM: number];

/** Everything a route's page shows, with its full track. */
export type Route = RouteRef & {
  uri: string;
  cid: string;
  name: string;
  description: string | null;
  activity: string;
  surface: string | null;
  difficulty: string | null;
  tags: string[];
  createdAt: Temporal.Instant;
  distanceM: number;
  elevationGainM: number | null;
  elevationLossM: number | null;
  isLoop: boolean;
  path: MultiLineString;
  /** Empty if the track has no elevation data. */
  elevationProfile: ElevationSample[];
  /** Empty if the route has moderation labels. */
  images: RouteImage[];
};

export type AspectRatio = { width: number; height: number };

export type RouteImage = {
  cid: string;
  alt: string;
  aspectRatio: AspectRatio | null;
  url: string;
};

/** A photo uploaded to the account, ready to add to a new route. */
export type UploadedRouteImage = {
  /** The blob ref as JSON. */
  image: {
    $type: "blob";
    ref: { $link: string };
    mimeType: string;
    size: number;
  };
  aspectRatio: AspectRatio;
};

export type Option = readonly [value: string, label: string];

/** A route search result, as the search endpoint returns it. */
export type RouteSearchItem = {
  did: string;
  rkey: string;
  name: string;
  activity: string;
  distance: string;
};

export const ROUTE_QUERY_MIN_LENGTH = 2;
export const ROUTE_QUERY_MAX_LENGTH = 100;

/** `maxLength` of `tags` in the `app.attrails.route` lexicon. */
export const ROUTE_MAX_TAGS = 20;

/** `maxGraphemes` of a tag in the `app.attrails.route` lexicon. */
export const ROUTE_TAG_MAX_GRAPHEMES = 64;

/** `maxGraphemes` of `name` in the `app.attrails.route` lexicon. */
export const ROUTE_NAME_MAX_GRAPHEMES = 100;

/** `maxGraphemes` of `description` in the `app.attrails.route` lexicon. */
export const ROUTE_DESCRIPTION_MAX_GRAPHEMES = 3000;

/** `maxLength` of `images` in the `app.attrails.route` lexicon. */
export const ROUTE_MAX_IMAGES = 10;

/** `maxGraphemes` of an image's `alt` in the `app.attrails.defs` lexicon. */
export const ROUTE_IMAGE_ALT_MAX_GRAPHEMES = 2000;

/** The largest photo people can upload, before it's converted. */
export const ROUTE_IMAGE_MAX_SIZE_BYTES = 15 * 1024 * 1024;

export const ROUTE_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];

const graphemes = new Intl.Segmenter();

function truncate(text: string, length: number): string {
  return Array.from(graphemes.segment(text), ({ segment }) => segment)
    .slice(0, length)
    .join("");
}

/**
 * Splits comma-separated tags, dropping leading `#`s, empty tags, and
 * duplicates that differ only in case. Keeps the first `ROUTE_MAX_TAGS`, each
 * cut to `ROUTE_TAG_MAX_GRAPHEMES`.
 */
export function parseTags(text: string): string[] {
  const tags = new Map<string, string>();
  for (const part of text.split(",")) {
    const tag = truncate(
      part.trim().replace(/^#+/, ""),
      ROUTE_TAG_MAX_GRAPHEMES,
    ).trim();
    if (tag && !tags.has(tag.toLowerCase())) {
      tags.set(tag.toLowerCase(), tag);
    }
  }
  return [...tags.values()].slice(0, ROUTE_MAX_TAGS);
}

const NAME_MESSAGE = "Give the route a name.";
const ACTIVITY_MESSAGE = "Choose an activity.";

const optional = (text: string) => text || undefined;

/**
 * The parts of a route that people edit, from form text. Tags are
 * comma-separated.
 */
export const routeSchema = z
  .object({
    name: z
      .string({ error: NAME_MESSAGE })
      .trim()
      .min(1, NAME_MESSAGE)
      .refine(
        (name) => graphemeCount(name) <= ROUTE_NAME_MAX_GRAPHEMES,
        `Keep the name to ${ROUTE_NAME_MAX_GRAPHEMES} characters.`,
      ),
    activity: z
      .string({ error: ACTIVITY_MESSAGE })
      .trim()
      .min(1, ACTIVITY_MESSAGE),
    description: z
      .string()
      .trim()
      .refine(
        (description) =>
          graphemeCount(description) <= ROUTE_DESCRIPTION_MAX_GRAPHEMES,
        `Keep the description to ${ROUTE_DESCRIPTION_MAX_GRAPHEMES} characters.`,
      ),
    surface: z.string().trim(),
    difficulty: z.string().trim(),
    tags: z.string(),
  })
  .transform((values) => {
    const tags = parseTags(values.tags);
    return {
      name: values.name,
      activity: values.activity,
      description: optional(values.description),
      surface: optional(values.surface),
      difficulty: optional(values.difficulty),
      tags: tags.length > 0 ? tags : undefined,
    };
  });

export type RouteDraft = z.output<typeof routeSchema>;

const aspectRatioSchema = z.object({
  width: z.int().positive(),
  height: z.int().positive(),
});

/** The photos of a new route, uploaded with `uploadRouteImage`. */
export const routeImagesSchema = z
  .array(
    z.object({
      image: z.object({
        $type: z.literal("blob"),
        ref: z.object({ $link: z.string() }),
        mimeType: z.string(),
        size: z.int().nonnegative(),
      }),
      alt: z
        .string()
        .trim()
        .refine(
          (alt) => graphemeCount(alt) <= ROUTE_IMAGE_ALT_MAX_GRAPHEMES,
          `Keep each photo's description to ${ROUTE_IMAGE_ALT_MAX_GRAPHEMES} characters.`,
        ),
      aspectRatio: aspectRatioSchema.optional(),
    }),
  )
  .max(ROUTE_MAX_IMAGES, `Add up to ${ROUTE_MAX_IMAGES} photos.`);

export type RouteImageDraft = z.output<typeof routeImagesSchema>[number];

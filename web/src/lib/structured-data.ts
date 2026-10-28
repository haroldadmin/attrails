import "server-only";

import type {
  AggregateRating,
  CreativeWork,
  ExerciseAction,
  Person,
  ProfilePage,
  WithContext,
} from "schema-dts";
import { activityLabel } from "@/lib/labels";
import { type Profile, profileName } from "@/lib/profiles";
import type { ReviewSummary } from "@/lib/reviews";
import type { Route } from "@/lib/routes";

export type JsonLdNode = WithContext<CreativeWork> | WithContext<ProfilePage>;

const SITE_URL = "https://www.attrails.app";

/**
 * Serializes a JSON-LD node for embedding in a script tag. Escaping `<` keeps
 * user-supplied text from closing the script tag.
 */
export function serializeJsonLd(data: JsonLdNode): string {
  return JSON.stringify(data)
    .replace(/</g, "\\u003c")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}

function distanceText(meters: number): string {
  return meters >= 1000
    ? `${Math.round(meters / 100) / 10} km`
    : `${Math.round(meters)} m`;
}

function personJsonLd(
  profile: Profile,
  { includeBio = false }: { includeBio?: boolean } = {},
): Person {
  const url = `${SITE_URL}/users/${profile.did}`;

  return {
    "@type": "Person",
    "@id": `${url}#person`,
    identifier: {
      "@type": "PropertyValue",
      propertyID: "atproto:did",
      value: profile.did,
    },
    name: profileName(profile),
    ...(profile.handle ? { alternateName: profile.handle } : {}),
    url,
    ...(profile.avatarUrl ? { image: `${SITE_URL}${profile.avatarUrl}` } : {}),
    ...(includeBio && profile.bio ? { description: profile.bio } : {}),
  };
}

/**
 * Describes a route as a creative work. Schema.org has no route type, so the
 * activity and distance are described by an `ExerciseAction` in `about`.
 */
export function routeJsonLd(
  route: Route,
  author: Profile,
  reviewSummary: ReviewSummary,
): WithContext<CreativeWork> {
  const url = `${SITE_URL}/routes/${route.did}/${route.rkey}`;

  const about: ExerciseAction = {
    "@type": "ExerciseAction",
    exerciseType: activityLabel(route.activity),
    distance: distanceText(route.distanceM),
  };

  const aggregateRating: AggregateRating | undefined =
    reviewSummary.count > 0 && reviewSummary.averageRating !== null
      ? {
          "@type": "AggregateRating",
          ratingValue: Math.round(reviewSummary.averageRating * 10) / 10,
          reviewCount: reviewSummary.count,
          bestRating: 5,
          worstRating: 1,
        }
      : undefined;

  return {
    "@context": "https://schema.org",
    "@type": "CreativeWork",
    "@id": url,
    url,
    name: route.name,
    ...(route.description ? { description: route.description } : {}),
    author: personJsonLd(author),
    datePublished: route.createdAt.toString(),
    image: `${url}/opengraph-image`,
    genre: activityLabel(route.activity),
    about,
    ...(route.tags.length > 0 ? { keywords: route.tags } : {}),
    isAccessibleForFree: true,
    ...(aggregateRating ? { aggregateRating } : {}),
  };
}

/** Describes a public user profile page and the ATProto identity it belongs to. */
export function profileJsonLd(profile: Profile): WithContext<ProfilePage> {
  const url = `${SITE_URL}/users/${profile.did}`;

  return {
    "@context": "https://schema.org",
    "@type": "ProfilePage",
    "@id": url,
    url,
    name: profileName(profile),
    ...(profile.bio ? { description: profile.bio } : {}),
    mainEntity: personJsonLd(profile, { includeBio: true }),
  };
}

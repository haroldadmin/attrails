import "server-only";

import { getFormatter } from "next-intl/server";
import { AtUri } from "@atproto/syntax";
import { type LabelledFilter, loadLabelledUris } from "@/lib/moderation";
import { loadAuthorReviews } from "@/lib/reviews";
import { activityLabel, loadRouteNames, loadRoutes } from "@/lib/routes";
import type { Page } from "@/lib/pages";

// What the lists render. Dates are formatted here so that the server-rendered
// first page and the pages loaded later read the same.

export type RouteListItem = {
  did: string;
  rkey: string;
  name: string;
  activity: string;
  uploadedAt: string;
  uploadedOn: string;
};

export type ReviewListItem = {
  uri: string;
  rating: number;
  text: string | null;
  createdAt: string;
  createdOn: string;
  labelled: boolean;
  route: { did: string; rkey: string; name: string };
};

const ROUTES_PAGE_SIZE = 20;
const REVIEWS_PAGE_SIZE = 20;

export async function fetchRouteList(
  did: string,
  { cursor, labelled }: { cursor?: string; labelled: LabelledFilter },
): Promise<Page<RouteListItem>> {
  const [page, format] = await Promise.all([
    loadRoutes({
      author: did,
      labelled,
      cursor,
      limit: ROUTES_PAGE_SIZE,
    }),
    getFormatter(),
  ]);

  return {
    ...page,
    items: page.items.map((route) => ({
      did: route.did,
      rkey: route.rkey,
      name: route.name,
      activity: activityLabel(route.activity),
      uploadedAt: route.uploadedAt.toString(),
      uploadedOn: format.dateTime(route.uploadedAt.epochMilliseconds, {
        dateStyle: "medium",
      }),
    })),
  };
}

export async function fetchReviewList(
  did: string,
  cursor?: string,
): Promise<Page<ReviewListItem>> {
  const [page, format] = await Promise.all([
    loadAuthorReviews(did, {
      labelled: "include",
      cursor,
      limit: REVIEWS_PAGE_SIZE,
    }),
    getFormatter(),
  ]);
  const [routeNames, labelled] = await Promise.all([
    loadRouteNames(page.items.map((review) => review.subject.uri)),
    loadLabelledUris(page.items),
  ]);

  return {
    ...page,
    // Reviews of routes that have been deleted are left out.
    items: page.items.flatMap((review) => {
      const name = routeNames.get(review.subject.uri);
      if (name === undefined) {
        return [];
      }

      const route = new AtUri(review.subject.uri);

      return {
        uri: review.uri,
        rating: review.rating,
        text: review.text,
        createdAt: review.createdAt.toString(),
        createdOn: format.dateTime(review.createdAt.epochMilliseconds, {
          dateStyle: "long",
        }),
        labelled: labelled.has(review.uri),
        route: { did: route.hostname, rkey: route.rkey, name },
      };
    }),
  };
}

import "server-only";

import { getFormatter } from "next-intl/server";
import { fetchReviewsByAuthor } from "@/lib/reviews";
import { fetchRoutesByAuthor } from "@/lib/routes";
import { activityLabel } from "@/lib/labels";
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
  rkey: string;
  rating: number;
  text: string | null;
  createdAt: string;
  createdOn: string;
  route: { did: string; rkey: string; name: string };
};

const ROUTES_PAGE_SIZE = 20;
const REVIEWS_PAGE_SIZE = 20;

export async function fetchRouteList(
  did: string,
  cursor?: string,
): Promise<Page<RouteListItem>> {
  const [page, format] = await Promise.all([
    fetchRoutesByAuthor(did, { cursor, limit: ROUTES_PAGE_SIZE }),
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
    fetchReviewsByAuthor(did, { cursor, limit: REVIEWS_PAGE_SIZE }),
    getFormatter(),
  ]);

  return {
    ...page,
    items: page.items.map((review) => ({
      rkey: review.rkey,
      rating: review.rating,
      text: review.text,
      createdAt: review.createdAt.toString(),
      createdOn: format.dateTime(review.createdAt.epochMilliseconds, {
        dateStyle: "long",
      }),
      route: review.route,
    })),
  };
}

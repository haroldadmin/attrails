"use server";

import { getSession } from "@/auth/session";
import type { Page } from "@/lib/pages";
import {
  fetchReviewList,
  fetchRouteList,
  type ReviewListItem,
  type RouteListItem,
} from "./listings";

export async function loadRoutes(cursor: string): Promise<Page<RouteListItem>> {
  const session = await getSession();
  if (!session || typeof cursor !== "string") {
    return { items: [], nextCursor: null };
  }

  return fetchRouteList(session.did, cursor);
}

export async function loadReviews(
  cursor: string,
): Promise<Page<ReviewListItem>> {
  const session = await getSession();
  if (!session || typeof cursor !== "string") {
    return { items: [], nextCursor: null };
  }

  return fetchReviewList(session.did, cursor);
}

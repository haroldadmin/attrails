"use server";

import type { Page } from "@/lib/pages";
import { fetchRouteList, type RouteListItem } from "../listings";

export async function loadUserRoutes(
  did: string,
  cursor: string,
): Promise<Page<RouteListItem>> {
  if (typeof did !== "string" || typeof cursor !== "string") {
    return { items: [], nextCursor: null };
  }

  return fetchRouteList(did, { cursor, hideLabelled: true });
}

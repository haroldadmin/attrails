import convert from "convert";
import type { NextRequest } from "next/server";
import { getFormatter, getLocale } from "next-intl/server";
import { unitsForLocale } from "@/i18n/units";
import { activityLabel } from "@/lib/labels";
import {
  MAX_QUERY_LENGTH,
  MIN_QUERY_LENGTH,
  type RouteSearchItem,
} from "@/lib/route-search";
import { searchRoutes } from "@/lib/routes";

const RESULTS_LIMIT = 10;

// Lets the browser reuse results as the reader edits their query. Kept short
// and private so moderation and deletions show up quickly. Distances are
// formatted for the reader's locale.
const CACHE_HEADERS = {
  "Cache-Control": "private, max-age=60",
  Vary: "Accept-Language",
};

export async function GET(request: NextRequest) {
  const query = (request.nextUrl.searchParams.get("q") ?? "")
    .slice(0, MAX_QUERY_LENGTH)
    .trim();
  if (query.length < MIN_QUERY_LENGTH) {
    return Response.json({ items: [] }, { headers: CACHE_HEADERS });
  }

  const [routes, format, locale] = await Promise.all([
    searchRoutes(query, RESULTS_LIMIT),
    getFormatter(),
    getLocale(),
  ]);
  const units = unitsForLocale(locale);

  const items: RouteSearchItem[] = routes.map((route) => ({
    did: route.did,
    rkey: route.rkey,
    name: route.name,
    activity: activityLabel(route.activity),
    distance: format.number(
      convert(route.distanceM, "meters").to(units.distance),
      "distance",
    ),
  }));

  return Response.json({ items }, { headers: CACHE_HEADERS });
}

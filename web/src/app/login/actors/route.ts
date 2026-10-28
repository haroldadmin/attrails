import type { NextRequest } from "next/server";
import { logger } from "@/lib/logger";
import {
  ACTOR_QUERY_MAX_LENGTH,
  ACTOR_QUERY_MIN_LENGTH,
  fetchActorSuggestions,
} from "@/lib/profiles";

const RESULTS_LIMIT = 6;

const CACHE_HEADERS = { "Cache-Control": "private, max-age=60" };

export async function GET(request: NextRequest) {
  const query = (request.nextUrl.searchParams.get("q") ?? "")
    .slice(0, ACTOR_QUERY_MAX_LENGTH)
    .trim()
    .replace(/^@/, "");
  if (query.length < ACTOR_QUERY_MIN_LENGTH) {
    return Response.json({ items: [] }, { headers: CACHE_HEADERS });
  }

  try {
    const items = await fetchActorSuggestions(query, {
      limit: RESULTS_LIMIT,
    });
    return Response.json({ items }, { headers: CACHE_HEADERS });
  } catch (error) {
    logger.warn({ err: error, query }, "login:actor-search");
    return Response.json({ items: [] }, { status: 502 });
  }
}

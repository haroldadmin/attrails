import type { NextRequest } from "next/server";
import { MAX_QUERY_LENGTH, MIN_QUERY_LENGTH } from "@/lib/actor-search";
import { logger } from "@/lib/logger";
import { searchBskyActors } from "@/lib/profiles";

const RESULTS_LIMIT = 6;

const CACHE_HEADERS = { "Cache-Control": "private, max-age=60" };

export async function GET(request: NextRequest) {
  const query = (request.nextUrl.searchParams.get("q") ?? "")
    .slice(0, MAX_QUERY_LENGTH)
    .trim()
    .replace(/^@/, "");
  if (query.length < MIN_QUERY_LENGTH) {
    return Response.json({ items: [] }, { headers: CACHE_HEADERS });
  }

  try {
    const items = await searchBskyActors(query, RESULTS_LIMIT);
    return Response.json({ items }, { headers: CACHE_HEADERS });
  } catch (error) {
    logger.warn({ err: error, query }, "login:actor-search");
    return Response.json({ items: [] }, { status: 502 });
  }
}

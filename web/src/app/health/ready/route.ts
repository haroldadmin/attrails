import { sql } from "kysely";
import { getDb } from "@/db/client";
import { logger } from "@/lib/logger";

export async function GET() {
  const checks = [await checkPostgres()];
  if (checks.some((ready) => ready === false)) {
    return Response.json(
      { status: "unavailable" },
      {
        status: 503,
        headers: { "cache-control": "no-store" },
      },
    );
  }

  return Response.json(
    { status: "ready" },
    {
      status: 200,
      headers: {
        "cache-control": "no-store",
      },
    },
  );
}

async function checkPostgres(): Promise<boolean> {
  try {
    const db = await getDb();
    await sql`SELECT 1`.execute(db);
    return true;
  } catch (error) {
    logger.error({ err: error }, "healthcheck:pg");
    return false;
  }
}

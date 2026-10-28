import { readdir, readFile } from "node:fs/promises";
import {
  PostgreSqlContainer,
  type StartedPostgreSqlContainer,
} from "@testcontainers/postgresql";
import { sql } from "kysely";
import { Client } from "pg";
import { afterAll, beforeAll, beforeEach } from "vitest";
import { getDb } from "@/db/client";

// Keep the Postgres major version in line with production.
const IMAGE = "postgis/postgis:18-3.6";

const MIGRATIONS = new URL(
  "../../../crates/database/migrations/",
  import.meta.url,
);

/**
 * Runs the calling test file against a Postgres container with every
 * migration applied, through the app's own `getDb`. Tables are emptied before
 * each test. Needs Docker.
 */
export function setUpTestDatabase(): void {
  let container: StartedPostgreSqlContainer | undefined;

  beforeAll(async () => {
    container = await new PostgreSqlContainer(IMAGE).start();
    const connectionString = container.getConnectionUri();

    const client = new Client({ connectionString });
    await client.connect();
    try {
      const files = (await readdir(MIGRATIONS))
        .filter((file) => file.endsWith(".sql"))
        .sort();
      for (const file of files) {
        await client.query(await readFile(new URL(file, MIGRATIONS), "utf8"));
      }
    } finally {
      await client.end();
    }

    process.env.ATTRAILS_POSTGRES_CONNECTION_URI = connectionString;
  }, 120_000);

  beforeEach(async () => {
    const db = await getDb();
    await sql`TRUNCATE reviews, routes, labels`.execute(db);
  });

  afterAll(async () => {
    const global = globalThis as { attrailsDb?: { destroy(): Promise<void> } };
    await global.attrailsDb?.destroy();
    global.attrailsDb = undefined;
    await container?.stop();
  });
}

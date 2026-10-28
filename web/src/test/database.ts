import { readdir, readFile } from "node:fs/promises";
import {
  PostgreSqlContainer,
  type StartedPostgreSqlContainer,
} from "@testcontainers/postgresql";
import { sql } from "kysely";
import {
  type Migration,
  type MigrationProvider,
  Migrator,
} from "kysely/migration";
import { afterAll, beforeAll, beforeEach } from "vitest";
import { getDb } from "@/db/client";

// Keep the Postgres major version in line with production.
const IMAGE = "postgis/postgis:18-3.6";

const MIGRATIONS = new URL(
  "../../../crates/database/migrations/",
  import.meta.url,
);

// Applies the SQL migrations that sqlx runs in production.
const sqlMigrations: MigrationProvider = {
  async getMigrations() {
    const files = (await readdir(MIGRATIONS)).filter((file) =>
      file.endsWith(".sql"),
    );

    const migrations: Record<string, Migration> = {};
    for (const file of files) {
      const text = await readFile(new URL(file, MIGRATIONS), "utf8");
      migrations[file] = {
        up: async (db) => {
          await sql.raw(text).execute(db);
        },
      };
    }
    return migrations;
  },
};

/**
 * Runs the calling test file against a Postgres container with every
 * migration applied, through the app's own `getDb`. Tables are emptied before
 * each test. Needs Docker.
 */
export function setUpTestDatabase(): void {
  let container: StartedPostgreSqlContainer | undefined;

  beforeAll(async () => {
    container = await new PostgreSqlContainer(IMAGE).start();
    process.env.ATTRAILS_POSTGRES_CONNECTION_URI = container.getConnectionUri();

    const migrator = new Migrator({
      db: await getDb(),
      provider: sqlMigrations,
    });
    const { error } = await migrator.migrateToLatest();
    if (error) {
      throw error;
    }
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

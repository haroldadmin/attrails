import "server-only";
import { Kysely, PostgresDialect } from "kysely";
import { connection } from "next/server";
import { Pool, types, type CustomTypesConfig } from "pg";
import type { DB } from "./types";
import { envOrThrow } from "@/env";

export type { DB, Reviews, Routes, Tracks, Users } from "./types";
export type AttrailsDb = Kysely<DB>;

// Keep in sync with `typeMapping` in .kysely-codegenrc.json.
const temporalParsers: Partial<Record<number, (value: string) => unknown>> = {
  [types.builtins.DATE]: (value) => Temporal.PlainDate.from(value),
  [types.builtins.TIME]: (value) => Temporal.PlainTime.from(value),
  [types.builtins.TIMESTAMP]: (value) => Temporal.PlainDateTime.from(value),
  [types.builtins.TIMESTAMPTZ]: (value) => Temporal.Instant.from(value),
};

const temporalTypes: CustomTypesConfig = {
  getTypeParser: (oid: number, format?: "text" | "binary") =>
    temporalParsers[oid] ?? types.getTypeParser(oid, format),
};

// Preserve a database pool on `globalThis` to prevent Next.js hot reload
// from creating a new pool on every change.
const globalForDb = globalThis as typeof globalThis & {
  attrailsDb?: AttrailsDb;
};

function createDb(): AttrailsDb {
  const connectionString = envOrThrow("ATTRAILS_POSTGRES_CONNECTION_URI");

  const pool = new Pool({
    connectionString,
    max: 10,
    connectionTimeoutMillis: 5_000,
    types: temporalTypes,
  });

  return new Kysely<DB>({ dialect: new PostgresDialect({ pool }) });
}

/**
 * Returns the shared database client.
 *
 * Awaits on a `connection()` before returning the client
 * to ensure any page that uses `getDb()` does not participate
 * pre-rendering. This keeps the build process free from a database
 * dependency.
 */
export async function getDb(): Promise<AttrailsDb> {
  await connection();
  globalForDb.attrailsDb ??= createDb();
  return globalForDb.attrailsDb;
}

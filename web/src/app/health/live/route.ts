import { connection } from "next/server";

export async function GET() {
  await connection();
  return new Response("ok", { headers: { "Cache-Control": "no-store" } });
}

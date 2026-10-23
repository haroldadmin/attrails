import { notFound } from "next/navigation";
import { connection } from "next/server";
import { getOAuthClient, isLoopback } from "@/auth/client";

export async function GET() {
  await connection();
  if (isLoopback()) {
    notFound();
  }

  const { keyset } = getOAuthClient();
  return Response.json(keyset?.publicJwks);
}

import { redirect } from "next/navigation";
import { connection, type NextRequest } from "next/server";
import { getOAuthClient } from "@/auth/client";
import { ensureProfileDeclaration } from "@/auth/declaration";
import { startWebSession } from "@/auth/session";

export async function GET(request: NextRequest) {
  await connection();

  let did: string;
  try {
    const { session } = await getOAuthClient().callback(
      request.nextUrl.searchParams,
    );
    await ensureProfileDeclaration(session);
    did = session.did;
  } catch (error) {
    console.warn("auth:callback", error);
    redirect("/login?error=callback");
  }

  await startWebSession(did);
  redirect("/");
}

import { redirect } from "next/navigation";
import { connection, type NextRequest } from "next/server";
import { getOAuthClient } from "@/auth/client";
import { safeReturnTo } from "@/auth/return-to";
import { ensureProfileDeclaration } from "@/auth/declaration";
import { startWebSession } from "@/auth/session";
import { logger } from "@/lib/logger";

export async function GET(request: NextRequest) {
  await connection();

  let did: string;
  let returnTo: string | undefined;
  try {
    const { session, state } = await getOAuthClient().callback(
      request.nextUrl.searchParams,
    );
    await ensureProfileDeclaration(session);
    did = session.did;
    returnTo = safeReturnTo(state);
  } catch (error) {
    logger.warn({ err: error }, "auth:callback");
    redirect("/login?error=callback");
  }

  await startWebSession(did);
  redirect(returnTo ?? "/");
}

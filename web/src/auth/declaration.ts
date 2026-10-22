import "server-only";

import { Client, currentDatetimeString, XrpcResponseError } from "@atproto/lex";
import type { OAuthSession } from "@atproto/oauth-client-node";
import { app } from "@/lexicons";
import { getAuthorProfile } from "@/lib/profiles";

/**
 * Makes sure the signed-in account has an `app.attrails.actor.profile`
 * record, which is what marks it as an attrails user for ingestion.
 */
export async function ensureProfileDeclaration(
  session: OAuthSession,
): Promise<void> {
  const client = new Client(session);

  try {
    await client.get(app.attrails.actor.profile);
    return;
  } catch (error) {
    if (
      !(error instanceof XrpcResponseError) ||
      error.error !== "RecordNotFound"
    ) {
      throw error;
    }
  }

  const profile = await getAuthorProfile(session.did);
  await client.create(app.attrails.actor.profile, {
    name: profile.displayName ?? profile.handle ?? session.did,
    createdAt: currentDatetimeString(),
  });
}

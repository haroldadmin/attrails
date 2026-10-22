import "server-only";

import {
  buildAtprotoLoopbackClientMetadata,
  NodeOAuthClient,
} from "@atproto/oauth-client-node";
import { envOrThrow } from "@/env";
import { requestLock, sessionStore, stateStore } from "./stores";

export const OAUTH_SCOPE = [
  "atproto",
  "repo:app.attrails.v0.route",
  "repo:app.attrails.v0.review",
  "repo:app.attrails.actor.profile",
  "blob:application/gpx+xml",
].join(" ");

export function getWebUrl(): URL {
  return new URL(envOrThrow("ATTRAILS_WEB_URL"));
}

let oauthClient: NodeOAuthClient | undefined;

/**
 * Returns the shared OAuth client.
 *
 * This is a loopback client, which ATProto only allows for local development:
 * `ATTRAILS_WEB_URL` must use `127.0.0.1` rather than `localhost`.
 */
export function getOAuthClient(): NodeOAuthClient {
  oauthClient ??= new NodeOAuthClient({
    clientMetadata: buildAtprotoLoopbackClientMetadata({
      scope: OAUTH_SCOPE,
      redirect_uris: [new URL("/oauth/callback", getWebUrl()).href],
    }),
    stateStore,
    sessionStore,
    requestLock,
  });

  return oauthClient;
}

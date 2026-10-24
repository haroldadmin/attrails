import "server-only";

import { safeFetchWrap } from "@atproto-labs/fetch-node";
import {
  buildAtprotoLoopbackClientMetadata,
  JoseKey,
  type Jwk,
  jwkSchema,
  NodeOAuthClient,
  type NodeOAuthClientOptions,
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

/**
 * Whether this is a local development server.
 *
 * Local development servers in ATProto can generate
 * authentication requests without needing to verify
 * their public key or client metadata.
 */
export function isLoopback(): boolean {
  return ["127.0.0.1", "[::1]"].includes(getWebUrl().hostname);
}

let oauthClient: NodeOAuthClient | undefined;

/**
 * Returns the shared OAuth client.
 */
export function getOAuthClient(): NodeOAuthClient {
  oauthClient ??= createOAuthClient();
  return oauthClient;
}

function createOAuthClient(): NodeOAuthClient {
  const webUrl = getWebUrl();
  const redirectUri = new URL("/oauth/callback", webUrl).href;

  const options = {
    stateStore,
    sessionStore,
    requestLock,
    fetch: safeFetchWrap({ allowImplicitRedirect: true }),
  };
  if (isLoopback()) {
    return new NodeOAuthClient({
      ...options,
      clientMetadata: buildAtprotoLoopbackClientMetadata({
        scope: OAUTH_SCOPE,
        redirect_uris: [redirectUri],
      }),
    });
  }

  const privateKey = jwkSchema.parse(
    JSON.parse(envOrThrow("ATTRAILS_OAUTH_PRIVATE_KEY")),
  );
  return new NodeOAuthClient({
    ...options,
    clientMetadata: confidentialClientMetadata(webUrl, redirectUri),
    keyset: [new JoseKey<Jwk>(privateKey)],
  });
}

function confidentialClientMetadata(
  webUrl: URL,
  redirectUri: string,
): NodeOAuthClientOptions["clientMetadata"] {
  return {
    client_id: new URL("/oauth/client-metadata.json", webUrl).href,
    client_name: "ATTrails",
    client_uri: webUrl.origin,
    logo_uri: new URL("/icon.png", webUrl).href,
    redirect_uris: [redirectUri],
    scope: OAUTH_SCOPE,
    grant_types: ["authorization_code", "refresh_token"],
    response_types: ["code"],
    application_type: "web",
    token_endpoint_auth_method: "private_key_jwt",
    token_endpoint_auth_signing_alg: "ES256",
    dpop_bound_access_tokens: true,
    jwks_uri: new URL("/oauth/jwks.json", webUrl).href,
  };
}

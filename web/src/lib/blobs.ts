import "server-only";

import {
  createDidResolver,
  DidCacheMemory,
  extractPdsUrl,
  isAtprotoDid,
} from "@atproto-labs/did-resolver";

const didResolver = createDidResolver({ didCache: new DidCacheMemory() });

/**
 * Fetches a blob from the PDS that hosts `did`'s repository.
 *
 * Throws if the DID can't be resolved or the PDS doesn't return the blob.
 */
export async function fetchBlob(did: string, cid: string): Promise<Response> {
  if (!isAtprotoDid(did)) {
    throw new Error(`Unsupported DID ${did}`);
  }

  const signal = AbortSignal.timeout(10_000);
  const document = await didResolver.resolve(did, { signal });

  const url = new URL(
    "/xrpc/com.atproto.sync.getBlob",
    extractPdsUrl(document),
  );
  url.search = new URLSearchParams({ did, cid }).toString();

  const response = await fetch(url, { signal });
  if (!response.ok) {
    throw new Error(`getBlob returned ${response.status} for ${did}/${cid}`);
  }

  return response;
}

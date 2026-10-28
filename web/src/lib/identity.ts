/** Whoever is looking at a page: a signed-in account, or `null` when signed out. */
export type Viewer = { did: string } | null;

export type RecordUri = { did: string; collection: string; rkey: string };

/**
 * Splits an `at://did/collection/rkey` record URI into its parts, or returns
 * `null` if `uri` isn't one.
 */
export function parseRecordUri(uri: string): RecordUri | null {
  const match = /^at:\/\/([^/]+)\/([^/]+)\/([^/]+)$/.exec(uri);
  return match ? { did: match[1], collection: match[2], rkey: match[3] } : null;
}

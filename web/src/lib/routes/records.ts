import "server-only";

import {
  type Agent,
  Client,
  currentDatetimeString,
  XrpcResponseError,
} from "@atproto/lex";
import { AtUri } from "@atproto/syntax";
import { app } from "@/lexicons";
import { logger } from "@/lib/logger";
import type { RouteDraft, RouteRef } from "./shared";

const { route } = app.attrails;

const GPX_ENCODING = "application/gpx+xml";

export type CreateRouteError = "invalid" | "write-failed";

export type CreateRouteResult =
  { ok: true; ref: RouteRef } | { ok: false; reason: CreateRouteError };

/**
 * Uploads `gpx` and creates a route record for it in the account's
 * repository. Check the file with `parseGpx` first.
 */
export async function createRoute(
  agent: Agent,
  draft: RouteDraft,
  gpx: Uint8Array,
): Promise<CreateRouteResult> {
  const client = new Client(agent);

  try {
    const { body } = await client.uploadBlob(gpx, { encoding: GPX_ENCODING });

    // The PDS deletes the uploaded blob on its own once nothing references it.
    const record = route.$safeValidate(
      route.$build({
        ...draft,
        track: body.blob,
        createdAt: currentDatetimeString(),
      }),
    );
    if (!record.success) {
      return { ok: false, reason: "invalid" };
    }

    const { uri } = await client.create(route, record.value);
    return {
      ok: true,
      ref: { did: client.assertDid, rkey: new AtUri(uri).rkey },
    };
  } catch (error) {
    logger.warn({ err: error, did: client.did }, "routes:create");
    return { ok: false, reason: "write-failed" };
  }
}

export type SaveRouteError =
  "not-owner" | "conflict" | "not-found" | "invalid" | "write-failed";

export type SaveRouteResult =
  { ok: true } | { ok: false; reason: SaveRouteError };

/**
 * Saves `draft` over the account's route record, keeping the fields people
 * don't edit, such as the track. `swapCid` is the version the draft was made
 * from: if the record has changed since, nothing is saved.
 */
export async function saveRoute(
  agent: Agent,
  ref: RouteRef,
  draft: RouteDraft,
  { swapCid }: { swapCid: string },
): Promise<SaveRouteResult> {
  const client = new Client(agent);
  if (ref.did !== client.assertDid) {
    return { ok: false, reason: "not-owner" };
  }

  try {
    const current = await client.get(route, { rkey: ref.rkey });
    const record = route.$safeValidate({ ...current.value, ...draft });
    if (!record.success) {
      return { ok: false, reason: "invalid" };
    }

    await client.put(route, record.value, {
      rkey: ref.rkey,
      swapRecord: swapCid,
    });
    return { ok: true };
  } catch (error) {
    if (error instanceof XrpcResponseError) {
      if (error.error === "InvalidSwap") {
        return { ok: false, reason: "conflict" };
      }
      if (error.error === "RecordNotFound") {
        return { ok: false, reason: "not-found" };
      }
    }

    logger.warn({ err: error, ...ref }, "routes:save");
    return { ok: false, reason: "write-failed" };
  }
}

export type DeleteRouteError = "not-owner" | "write-failed";

export type DeleteRouteResult =
  { ok: true } | { ok: false; reason: DeleteRouteError };

/** Deletes the account's route record. */
export async function deleteRoute(
  agent: Agent,
  ref: RouteRef,
): Promise<DeleteRouteResult> {
  const client = new Client(agent);
  if (ref.did !== client.assertDid) {
    return { ok: false, reason: "not-owner" };
  }

  try {
    await client.delete(route, { rkey: ref.rkey });
    return { ok: true };
  } catch (error) {
    logger.warn({ err: error, ...ref }, "routes:delete");
    return { ok: false, reason: "write-failed" };
  }
}

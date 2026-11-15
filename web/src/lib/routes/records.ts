import "server-only";

import {
  type Agent,
  Client,
  currentDatetimeString,
  jsonToLex,
  lexToJson,
  XrpcResponseError,
} from "@atproto/lex";
import { AtUri } from "@atproto/syntax";
import { app } from "@/lexicons";
import { type ProcessPhotoError, processPhoto } from "@/lib/images";
import { logger } from "@/lib/logger";
import type {
  RouteDraft,
  RouteImageDraft,
  RouteRef,
  UploadedRouteImage,
} from "./shared";

const { route } = app.attrails;

const GPX_ENCODING = "application/gpx+xml";
const IMAGE_ENCODING = "image/webp";

export type UploadRouteImageError = ProcessPhotoError | "write-failed";

export type UploadRouteImageResult =
  | { ok: true; image: UploadedRouteImage }
  | { ok: false; reason: UploadRouteImageError };

/**
 * Converts a photo with `processPhoto` and uploads it to the account, to add
 * to a route with `createRoute`.
 */
export async function uploadRouteImage(
  agent: Agent,
  bytes: Uint8Array,
): Promise<UploadRouteImageResult> {
  const photo = await processPhoto(bytes);
  if (!photo.ok) {
    return photo;
  }

  const client = new Client(agent);
  try {
    const { body } = await client.uploadBlob(photo.data, {
      encoding: IMAGE_ENCODING,
    });
    return {
      ok: true,
      image: {
        image: lexToJson(body.blob) as UploadedRouteImage["image"],
        aspectRatio: { width: photo.width, height: photo.height },
      },
    };
  } catch (error) {
    logger.warn({ err: error, did: client.did }, "routes:upload-image");
    return { ok: false, reason: "write-failed" };
  }
}

export type CreateRouteError = "invalid" | "write-failed";

export type CreateRouteResult =
  { ok: true; ref: RouteRef } | { ok: false; reason: CreateRouteError };

/**
 * Uploads `gpx` and creates a route record for it in the account's
 * repository, with `images` uploaded by `uploadRouteImage`. Check the file
 * with `parseGpx` first.
 */
export async function createRoute(
  agent: Agent,
  draft: RouteDraft,
  gpx: Uint8Array,
  images: RouteImageDraft[] = [],
): Promise<CreateRouteResult> {
  const client = new Client(agent);

  try {
    const { body } = await client.uploadBlob(gpx, { encoding: GPX_ENCODING });

    // The PDS deletes uploaded blobs on its own once nothing references them.
    const record = route.$safeValidate({
      ...route.$build({
        ...draft,
        track: body.blob,
        createdAt: currentDatetimeString(),
      }),
      ...(images.length > 0 && {
        images: images.map(({ image, ...rest }) => ({
          ...rest,
          image: jsonToLex(image),
        })),
      }),
    });
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

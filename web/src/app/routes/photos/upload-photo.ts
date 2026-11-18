import "server-only";

import type { Agent } from "@atproto/lex";
import {
  ROUTE_IMAGE_MAX_SIZE_BYTES,
  type UploadedRouteImage,
  uploadRouteImage,
} from "@/lib/routes";
import { photoErrorMessage } from "./photo-messages";

export type UploadPhotoResult =
  { ok: true; image: UploadedRouteImage } | { ok: false; error: string };

/** Uploads the `photo` a photos input submits, to add to a route. */
export async function uploadPhoto(
  agent: Agent,
  formData: FormData,
): Promise<UploadPhotoResult> {
  const file = formData.get("photo");
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: photoErrorMessage("unsupported") };
  }
  if (file.size > ROUTE_IMAGE_MAX_SIZE_BYTES) {
    return { ok: false, error: photoErrorMessage("too-large") };
  }

  const result = await uploadRouteImage(
    agent,
    new Uint8Array(await file.arrayBuffer()),
  );
  return result.ok
    ? result
    : { ok: false, error: photoErrorMessage(result.reason) };
}

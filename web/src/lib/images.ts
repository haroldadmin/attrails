import "server-only";

import sharp from "sharp";

const ACCEPTED_FORMATS = new Set(["jpeg", "png", "webp"]);
const MAX_INPUT_PIXELS = 100_000_000;
const MAX_SIDE = 2048;
// `maxSize` of an image blob in the `app.attrails.defs#image` lexicon.
const MAX_OUTPUT_BYTES = 1_000_000;
const QUALITIES = [80, 70, 60, 50];
// The moderation service can't classify images narrower than this.
const MAX_ASPECT_RATIO = 5;

export type ProcessPhotoError = "unsupported" | "too-large" | "too-narrow";

export type ProcessPhotoResult =
  | { ok: true; data: Uint8Array; width: number; height: number }
  | { ok: false; reason: ProcessPhotoError };

/**
 * Converts a JPEG, PNG, or WebP photo to an upright WebP of at most 2048
 * pixels a side and 1 MB, without its metadata.
 */
export async function processPhoto(
  bytes: Uint8Array,
): Promise<ProcessPhotoResult> {
  const options = { limitInputPixels: MAX_INPUT_PIXELS, autoOrient: true };

  let metadata;
  try {
    metadata = await sharp(bytes, options).metadata();
  } catch {
    return { ok: false, reason: "unsupported" };
  }
  if (!ACCEPTED_FORMATS.has(metadata.format)) {
    return { ok: false, reason: "unsupported" };
  }

  const { width, height } = metadata.autoOrient;
  if (width * height > MAX_INPUT_PIXELS) {
    return { ok: false, reason: "too-large" };
  }
  if (Math.max(width / height, height / width) > MAX_ASPECT_RATIO) {
    return { ok: false, reason: "too-narrow" };
  }

  for (const quality of QUALITIES) {
    let output;
    try {
      output = await sharp(bytes, options)
        .resize({
          width: MAX_SIDE,
          height: MAX_SIDE,
          fit: "inside",
          withoutEnlargement: true,
        })
        .webp({ quality })
        .toBuffer({ resolveWithObject: true });
    } catch {
      return { ok: false, reason: "unsupported" };
    }

    if (output.data.byteLength <= MAX_OUTPUT_BYTES) {
      return {
        ok: true,
        data: output.data,
        width: output.info.width,
        height: output.info.height,
      };
    }
  }

  return { ok: false, reason: "too-large" };
}

import sharp from "sharp";
import { describe, expect, test } from "vitest";
import { processPhoto } from "./images";

function blank(width: number, height: number) {
  return sharp({
    create: { width, height, channels: 3, background: "#4a7f3c" },
  });
}

describe("processing photos", () => {
  test("converts to an upright, small WebP without metadata", async () => {
    // Stored sideways, with an orientation that turns it upright.
    const input = await blank(3000, 2000)
      .jpeg()
      .withExif({
        IFD0: { Copyright: "Someone" },
        IFD3: { GPSLatitudeRef: "N", GPSLatitude: "51/1 30/1 0/1" },
      })
      .withMetadata({ orientation: 6 })
      .toBuffer();
    const inputMetadata = await sharp(input).metadata();
    expect(inputMetadata).toMatchObject({ orientation: 6 });
    expect(inputMetadata.exif).toBeDefined();

    const result = await processPhoto(input);

    expect(result).toMatchObject({ ok: true, width: 1365, height: 2048 });
    if (!result.ok) return;
    expect(result.data.byteLength).toBeLessThanOrEqual(1_000_000);
    const metadata = await sharp(result.data).metadata();
    expect(metadata).toMatchObject({
      format: "webp",
      width: 1365,
      height: 2048,
    });
    expect(metadata.exif).toBeUndefined();
    expect(metadata.orientation).toBeUndefined();
  });

  test.each([
    [
      "an SVG",
      new TextEncoder().encode(
        '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"/>',
      ),
    ],
    ["not an image", new TextEncoder().encode("not an image")],
  ])("rejects %s as unsupported", async (_name, bytes) => {
    expect(await processPhoto(bytes)).toEqual({
      ok: false,
      reason: "unsupported",
    });
  });

  test("rejects photos too narrow to moderate", async () => {
    const input = await blank(1200, 200).png().toBuffer();
    expect(await processPhoto(input)).toEqual({
      ok: false,
      reason: "too-narrow",
    });
  });
});

import type { GpxErrorReason } from "@/lib/gpx";

export const GPX_TOO_LARGE_MESSAGE =
  "That route is too long to upload. Try a shorter route.";

const MESSAGES: Record<GpxErrorReason, string> = {
  "not-gpx":
    "We couldn't read that file. Choose a GPX file exported from your app or device.",
  "no-route": "That file doesn't contain a route.",
  "invalid-point": "That file looks damaged. Try exporting it again.",
};

export function gpxErrorMessage(reason: GpxErrorReason): string {
  return MESSAGES[reason];
}

import type { UploadRouteImageError } from "@/lib/routes";

const MESSAGES: Record<UploadRouteImageError, string> = {
  unsupported: "We couldn't read that photo. Choose a JPEG, PNG or WebP image.",
  "too-large": "That photo is too large. Try a smaller one.",
  "too-narrow": "That photo is too long and narrow. Try cropping it.",
  "write-failed":
    "We couldn't upload the photo to your account. Please try again.",
};

export function photoErrorMessage(reason: UploadRouteImageError): string {
  return MESSAGES[reason];
}

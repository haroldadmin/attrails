import "server-only";

import { headers } from "next/headers";

export type Location = { latitude: number; longitude: number };

// Two decimal places is roughly 1 km, which is plenty for IP geolocation.
const PRECISION = 100;

/**
 * The visitor's approximate location from Cloudflare's visitor location
 * headers, rounded to about 1 km, or `null` if the request didn't come
 * through Cloudflare. In development, `DEV_APPROXIMATE_LOCATION` (as
 * `latitude,longitude`) stands in for the headers.
 */
export async function approximateLocation(): Promise<Location | null> {
  const requestHeaders = await headers();
  let latitude = requestHeaders.get("cf-iplatitude");
  let longitude = requestHeaders.get("cf-iplongitude");
  if (
    (latitude === null || longitude === null) &&
    process.env.NODE_ENV === "development"
  ) {
    [latitude = null, longitude = null] =
      process.env.DEV_APPROXIMATE_LOCATION?.split(",") ?? [];
  }

  return parseLocation(latitude, longitude);
}

function parseLocation(
  latitude: string | null,
  longitude: string | null,
): Location | null {
  if (latitude === null || longitude === null) {
    return null;
  }

  const lat = Number.parseFloat(latitude);
  const lon = Number.parseFloat(longitude);
  if (
    Math.abs(lat) > 90 ||
    Math.abs(lon) > 180 ||
    !Number.isFinite(lat + lon)
  ) {
    return null;
  }

  return {
    latitude: Math.round(lat * PRECISION) / PRECISION,
    longitude: Math.round(lon * PRECISION) / PRECISION,
  };
}

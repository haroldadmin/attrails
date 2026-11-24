import "server-only";

import { cookies } from "next/headers";
import { getLocale } from "next-intl/server";
import { cache } from "react";
import { resolveUnits, UNITS_COOKIE, type Units } from "./units";

/** The units to show distances and elevations in for this request. */
export const getUnits = cache(async (): Promise<Units> => {
  const [locale, cookieStore] = await Promise.all([getLocale(), cookies()]);
  return resolveUnits(locale, cookieStore.get(UNITS_COOKIE)?.value);
});

import { cookies, headers } from "next/headers";
import { getRequestConfig } from "next-intl/server";
import { createFormats } from "./formats";
import { negotiateLocale } from "./locale";
import { resolveUnits, UNITS_COOKIE } from "./units";

// next-intl reads the locale from the Accept-Language header, and units from
// a cookie, on each request. Anything that calls next-intl's server APIs
// therefore needs to render inside a `<Suspense>` boundary.
export default getRequestConfig(async () => {
  const [headerStore, cookieStore] = await Promise.all([headers(), cookies()]);
  const locale = negotiateLocale(headerStore.get("accept-language"));

  return {
    locale,
    formats: createFormats(
      resolveUnits(locale, cookieStore.get(UNITS_COOKIE)?.value),
    ),
  };
});

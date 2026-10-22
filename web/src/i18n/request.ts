import { headers } from "next/headers";
import { getRequestConfig } from "next-intl/server";
import { createFormats } from "./formats";
import { negotiateLocale } from "./locale";
import { unitsForLocale } from "./units";

// next-intl reads the locale from the Accept-Language header on each request.
// Anything that calls next-intl's server APIs therefore needs to render
// inside a `<Suspense>` boundary.
export default getRequestConfig(async () => {
  const userPref = (await headers()).get("accept-language");
  const locale = negotiateLocale(userPref);

  return {
    locale,
    formats: createFormats(unitsForLocale(locale)),
  };
});

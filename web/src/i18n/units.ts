import { z } from "zod";

export const UNITS_COOKIE = "attrails_units";

export const unitsSchema = z.object({
  distance: z.enum(["kilometer", "mile"]),
  elevation: z.enum(["meter", "foot"]),
});

export type Units = z.infer<typeof unitsSchema>;
export type DistanceUnit = Units["distance"];
export type ElevationUnit = Units["elevation"];

const IMPERIAL_REGIONS = new Set(["US", "LR", "MM"]);

/**
 * Intl has no API for a locale's measurement system, so derive it from the
 * likely region: "en" maximizes to "en-Latn-US", "de" to "de-Latn-DE".
 */
export function unitsForLocale(locale: string): Units {
  const region = new Intl.Locale(locale).maximize().region;
  if (region && IMPERIAL_REGIONS.has(region)) {
    return { distance: "mile", elevation: "foot" };
  }

  if (region === "GB") {
    return { distance: "mile", elevation: "meter" };
  }

  return { distance: "kilometer", elevation: "meter" };
}

export function serializeUnits(units: Units): string {
  return new URLSearchParams(units).toString();
}

/**
 * The units a reader chose, if their cookie holds a valid choice, or else
 * the units of their locale.
 */
export function resolveUnits(
  locale: string,
  cookieValue: string | undefined,
): Units {
  if (!cookieValue) {
    return unitsForLocale(locale);
  }

  const chosen = unitsSchema.safeParse(
    Object.fromEntries(new URLSearchParams(cookieValue)),
  );

  if (!chosen.success) {
    return unitsForLocale(locale);
  }

  return chosen.data;
}

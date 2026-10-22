export type DistanceUnit = "kilometer" | "mile";
export type ElevationUnit = "meter" | "foot";

export type Units = {
  distance: DistanceUnit;
  elevation: ElevationUnit;
};

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

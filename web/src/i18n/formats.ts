import type { Formats } from "next-intl";
import type { Units } from "./units";

/**
 * Named formats for next-intl's `format.number` and friends.
 *
 * Unit formats expect values already converted to the locale's units, e.g.
 * `format.number(convert(meters, "meters").to(units.distance), "distance")`.
 */
export function createFormats(units: Units) {
  return {
    number: {
      distance: {
        style: "unit",
        unit: units.distance,
        unitDisplay: "short",
        maximumFractionDigits: 1,
      },
      elevation: {
        style: "unit",
        unit: units.elevation,
        unitDisplay: "short",
        maximumFractionDigits: 0,
      },
    },
  } satisfies Formats;
}

declare module "next-intl" {
  interface AppConfig {
    Formats: ReturnType<typeof createFormats>;
  }
}

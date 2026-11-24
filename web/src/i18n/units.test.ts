import { expect, test } from "vitest";
import { resolveUnits, serializeUnits } from "./units";

test("a saved choice overrides the locale's units", () => {
  const cookie = serializeUnits({ distance: "kilometer", elevation: "meter" });

  expect(resolveUnits("en-US", cookie)).toEqual({
    distance: "kilometer",
    elevation: "meter",
  });
});

test("without a saved choice, units follow the locale", () => {
  expect(resolveUnits("en-US", undefined)).toEqual({
    distance: "mile",
    elevation: "foot",
  });
  expect(resolveUnits("en-GB", undefined)).toEqual({
    distance: "mile",
    elevation: "meter",
  });
  expect(resolveUnits("de", undefined)).toEqual({
    distance: "kilometer",
    elevation: "meter",
  });
});

test("an invalid saved choice falls back to the locale's units", () => {
  expect(resolveUnits("de", "distance=furlong&elevation=foot")).toEqual({
    distance: "kilometer",
    elevation: "meter",
  });
  expect(resolveUnits("de", "garbage")).toEqual({
    distance: "kilometer",
    elevation: "meter",
  });
});

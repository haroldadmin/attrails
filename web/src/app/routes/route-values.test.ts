import { expect, test } from "vitest";
import { readRouteValues } from "./route-values";

test("combines every submitted tags value", () => {
  const formData = new FormData();
  formData.append("tags", "coastal");
  formData.append("tags", "hills");

  expect(readRouteValues(formData).tags).toBe("coastal,hills");
});

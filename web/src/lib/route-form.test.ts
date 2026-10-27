import { describe, expect, test } from "vitest";
import {
  MAX_TAG_LENGTH,
  MAX_TAGS,
  parseTags,
  readRouteValues,
  routeDetails,
} from "./route-form";

describe("parseTags", () => {
  test("cleans up comma-separated tags", () => {
    expect(parseTags(" coastal, #Cafe stop,, cafe STOP ,##hills ")).toEqual([
      "coastal",
      "Cafe stop",
      "hills",
    ]);
  });

  test("keeps at most the lexicon's number of tags", () => {
    const tags = parseTags(
      Array.from({ length: MAX_TAGS + 5 }, (_, index) => `tag ${index}`).join(),
    );

    expect(tags).toHaveLength(MAX_TAGS);
    expect(tags.at(-1)).toBe(`tag ${MAX_TAGS - 1}`);
  });

  test("cuts long tags without splitting characters", () => {
    const [tag] = parseTags("🏔️".repeat(MAX_TAG_LENGTH + 10));

    expect(tag).toBe("🏔️".repeat(MAX_TAG_LENGTH));
  });
});

test("combines every submitted tags value", () => {
  const formData = new FormData();
  formData.append("tags", "coastal");
  formData.append("tags", "hills");

  expect(routeDetails(readRouteValues(formData)).tags).toEqual([
    "coastal",
    "hills",
  ]);
});

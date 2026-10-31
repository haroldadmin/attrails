import "server-only";

import { app } from "@/lexicons";
import type { Option } from "./shared";

const { defs } = app.attrails;

export const ACTIVITIES: readonly Option[] = [
  [defs.Cycling, "Cycling"],
  [defs.Running, "Running"],
  [defs.Hiking, "Hiking"],
  [defs.Walking, "Walking"],
  [defs.Other, "Other"],
];

export const SURFACES: readonly Option[] = [
  [defs.Paved, "Paved"],
  [defs.Gravel, "Gravel"],
  [defs.Trail, "Trail"],
  [defs.Mixed, "Mixed"],
];

export const DIFFICULTIES: readonly Option[] = [
  [defs.Easy, "Easy"],
  [defs.Moderate, "Moderate"],
  [defs.Hard, "Hard"],
  [defs.Extreme, "Extreme"],
];

const ACTIVITY_LABELS: ReadonlyMap<string, string> = new Map(ACTIVITIES);

export function activityLabel(activity: string): string {
  return ACTIVITY_LABELS.get(activity) ?? "Other";
}

/** Activities offered as discovery filters, in display order. */
export const ACTIVITY_FILTERS: readonly Option[] = [
  [defs.Running, "Running"],
  [defs.Cycling, "Cycling"],
  [defs.Hiking, "Hiking"],
  [defs.Walking, "Walking"],
];

export const DEFAULT_ACTIVITY: string = defs.Running;

/** URL-safe identifier for an activity, e.g. `running`. */
export function activitySlug(activity: string): string {
  const index = activity.lastIndexOf("#");
  return index === -1 ? activity : activity.slice(index + 1);
}

const ACTIVITY_VALUES_BY_SLUG: ReadonlyMap<string, string> = new Map(
  ACTIVITY_FILTERS.map(([value]) => [activitySlug(value), value]),
);

/**
 * Resolves the activity slug from a page's URL. Returns `undefined` when the
 * activity is missing or isn't one that can be filtered by.
 */
export function activityFromSlug(slug: string | undefined): string | undefined {
  return slug ? ACTIVITY_VALUES_BY_SLUG.get(slug.toLowerCase()) : undefined;
}

const SURFACE_LABELS: ReadonlyMap<string, string> = new Map(SURFACES);

export function surfaceLabel(surface: string): string | undefined {
  return SURFACE_LABELS.get(surface);
}

const DIFFICULTY_LABELS: ReadonlyMap<string, string> = new Map(DIFFICULTIES);

export function difficultyLabel(difficulty: string): string | undefined {
  return DIFFICULTY_LABELS.get(difficulty);
}

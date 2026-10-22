import { app } from "@/lexicons";

const { defs } = app.attrails.v0;

export type Option = readonly [value: string, label: string];

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

/** What the route form submits, as typed. */
export type RouteValues = {
  name: string;
  description: string;
  activity: string;
  surface: string;
  difficulty: string;
  tags: string;
};

export function readRouteValues(formData: FormData): RouteValues {
  return {
    name: text(formData, "name"),
    description: text(formData, "description"),
    activity: text(formData, "activity"),
    surface: text(formData, "surface"),
    difficulty: text(formData, "difficulty"),
    // Tag inputs can submit more than one value; see `TagInput`.
    tags: formData
      .getAll("tags")
      .filter((value) => typeof value === "string")
      .join(","),
  };
}

function text(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

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
    tags: text(formData, "tags"),
  };
}

/** Returns a message describing what's wrong with `values`, if anything. */
export function checkRouteValues(values: RouteValues): string | undefined {
  if (!values.name) {
    return "Give the route a name.";
  }
  if (!values.activity) {
    return "Choose an activity.";
  }
}

/** The parts of a route record that the route form edits. */
export function routeDetails(values: RouteValues) {
  const tags = values.tags
    .split(",")
    .map((tag) => tag.trim())
    .filter((tag) => tag.length > 0);

  return {
    name: values.name,
    activity: values.activity,
    description: values.description || undefined,
    surface: values.surface || undefined,
    difficulty: values.difficulty || undefined,
    tags: tags.length > 0 ? tags : undefined,
  };
}

export function text(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

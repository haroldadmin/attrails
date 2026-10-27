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

/** Returns a message describing what's wrong with `values`, if anything. */
export function checkRouteValues(values: RouteValues): string | undefined {
  if (!values.name) {
    return "Give the route a name.";
  }
  if (!values.activity) {
    return "Choose an activity.";
  }
}

/** `maxLength` of `tags` in the `app.attrails.route` lexicon. */
export const MAX_TAGS = 20;

/** `maxGraphemes` of a tag in the `app.attrails.route` lexicon. */
export const MAX_TAG_LENGTH = 64;

const graphemes = new Intl.Segmenter();

/**
 * Splits comma-separated tags, dropping leading `#`s, empty tags, and
 * duplicates that differ only in case. Keeps the first `MAX_TAGS`, each cut to
 * `MAX_TAG_LENGTH` graphemes.
 */
export function parseTags(text: string): string[] {
  const tags = new Map<string, string>();
  for (const part of text.split(",")) {
    const tag = truncate(part.trim().replace(/^#+/, ""), MAX_TAG_LENGTH).trim();
    if (tag && !tags.has(tag.toLowerCase())) {
      tags.set(tag.toLowerCase(), tag);
    }
  }
  return [...tags.values()].slice(0, MAX_TAGS);
}

function truncate(text: string, length: number): string {
  return Array.from(graphemes.segment(text), ({ segment }) => segment)
    .slice(0, length)
    .join("");
}

/** The parts of a route record that the route form edits. */
export function routeDetails(values: RouteValues) {
  const tags = parseTags(values.tags);

  return {
    name: values.name,
    activity: values.activity,
    description: values.description || undefined,
    surface: values.surface || undefined,
    difficulty: values.difficulty || undefined,
    tags: tags.length > 0 ? tags : undefined,
  };
}

function text(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

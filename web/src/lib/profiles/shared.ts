// Safe to import from client components. Server code imports `@/lib/profiles`.

import { z } from "zod";
import { graphemeCount } from "@/lib/text";

export type Profile = {
  did: string;
  handle: string | null;
  displayName: string | null;
  bio: string | null;
  avatarUrl: string | null;
};

/** The name to show for a profile, falling back to its handle or bare DID. */
export function profileName(
  profile: Pick<Profile, "did" | "handle" | "displayName">,
): string {
  return profile.displayName ?? profile.handle ?? profile.did;
}

/** A Bluesky account suggested while typing a handle. */
export type ActorSuggestion = {
  did: string;
  handle: string;
  displayName: string | null;
  avatarUrl: string | null;
};

export const ACTOR_QUERY_MIN_LENGTH = 2;
export const ACTOR_QUERY_MAX_LENGTH = 253;

/** `maxGraphemes` of `name` in the `app.attrails.actor.profile` lexicon. */
export const PROFILE_NAME_MAX_GRAPHEMES = 100;

/** `maxGraphemes` of `bio` in the `app.attrails.actor.profile` lexicon. */
export const PROFILE_BIO_MAX_GRAPHEMES = 3000;

const NAME_MESSAGE = "Give your profile a name.";

/** The parts of a profile that people edit. */
export const profileSchema = z.object({
  name: z
    .string({ error: NAME_MESSAGE })
    .trim()
    .min(1, NAME_MESSAGE)
    .refine(
      (name) => graphemeCount(name) <= PROFILE_NAME_MAX_GRAPHEMES,
      `Keep your name to ${PROFILE_NAME_MAX_GRAPHEMES} characters.`,
    ),
  bio: z
    .string()
    .trim()
    .refine(
      (bio) => graphemeCount(bio) <= PROFILE_BIO_MAX_GRAPHEMES,
      `Keep your bio to ${PROFILE_BIO_MAX_GRAPHEMES} characters.`,
    ),
});

export type ProfileDraft = z.output<typeof profileSchema>;

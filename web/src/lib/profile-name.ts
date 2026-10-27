import type { AuthorProfile } from "@/lib/profiles";

/** The name to show for an author, falling back to their handle or bare DID. */
export function profileName(profile: AuthorProfile): string {
  return profile.displayName ?? profile.handle ?? profile.did;
}

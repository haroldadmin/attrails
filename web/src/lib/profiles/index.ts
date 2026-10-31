import "server-only";

// Everything the app reads, validates, and writes about profiles. Client
// components import `@/lib/profiles/shared` instead.

export * from "./shared";
export { fetchActorSuggestions } from "./appview";
export {
  type AvatarError,
  type AvatarResult,
  fetchAvatar,
  fetchProfile,
  fetchProfiles,
  fetchUserProfile,
} from "./queries";
export {
  ensureProfileRecord,
  fetchProfileRecord,
  type ProfileRecord,
  saveProfile,
  type SaveProfileError,
  type SaveProfileResult,
} from "./records";

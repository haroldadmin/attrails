// Shared by the account search endpoint and the login form.

export type ActorSearchItem = {
  did: string;
  handle: string;
  displayName: string | null;
  avatarUrl: string | null;
};

export const MIN_QUERY_LENGTH = 2;
export const MAX_QUERY_LENGTH = 253;

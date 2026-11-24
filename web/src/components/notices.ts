export const NOTICES = {
  "route-uploaded":
    "Route uploaded. It'll appear here once it has been processed.",
  "route-updated":
    "Route updated. Your changes will appear once they've been processed.",
  "route-deleted":
    "Route deleted. It'll disappear from your routes once it has been processed.",
  "review-posted":
    "Review posted. It'll appear in the reviews once it has been processed.",
  "review-updated":
    "Review updated. Your changes will appear in the reviews once they've been processed.",
  "review-deleted":
    "Review deleted. It'll disappear from the reviews once that has been processed.",
  "profile-updated":
    "Profile updated. It'll show up across ATTrails once it has been processed.",
} as const;

export type Notice = keyof typeof NOTICES;

export const NOTICE_PARAM = "notice";

export function isNotice(value: string | null): value is Notice {
  return value !== null && Object.hasOwn(NOTICES, value);
}

export function withNotice(path: string, notice: Notice): string {
  return `${path}?${new URLSearchParams({ [NOTICE_PARAM]: notice })}`;
}

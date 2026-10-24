import type { ReactNode } from "react";

/**
 * Explains that moderation labels limit who sees a route or review.
 */
export function ModerationNotice({ children }: { children: ReactNode }) {
  return <p className="alert alert-warning alert-soft">{children}</p>;
}

/**
 * Tells a review's author that only they can see it.
 */
export function ReviewModerationNotice() {
  return (
    <ModerationNotice>
      Automated moderation flagged your review, so only you can see it.
    </ModerationNotice>
  );
}

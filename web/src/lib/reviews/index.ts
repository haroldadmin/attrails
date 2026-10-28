import "server-only";

// Everything the app reads, validates, and writes about reviews. Client
// components import `@/lib/reviews/shared` instead.

export * from "./shared";
export {
  loadAuthorReviews,
  loadReviewSummary,
  loadReviews,
  loadViewerReview,
} from "./queries";
export {
  deleteReview,
  type DeleteReviewError,
  type DeleteReviewResult,
  saveReview,
  type SaveReviewError,
  type SaveReviewResult,
} from "./records";

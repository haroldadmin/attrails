"use server";

import { redirect } from "next/navigation";
import { assertSession } from "@/auth/session";
import { app } from "@/lexicons";
import {
  deleteReview,
  type DeleteReviewError,
  reviewSchema,
  saveReview,
  type SaveReviewError,
} from "@/lib/reviews";
import { fetchRoute } from "@/lib/routes";

export type ReviewValues = {
  rating: string;
  text: string;
};

export type ReviewState = {
  values: ReviewValues;
  error?: string;
};

const SAVE_ERROR_MESSAGES: Record<SaveReviewError, string> = {
  "self-review": "You can't review your own route.",
  invalid: "Check your review and try again.",
  "write-failed":
    "We couldn't save your review to your account. Please try again.",
};

export async function saveRouteReview(
  routeDid: string,
  routeRkey: string,
  _previous: ReviewState,
  formData: FormData,
): Promise<ReviewState> {
  const routePath = `/routes/${routeDid}/${routeRkey}`;
  const session = await assertSession(`${routePath}/review`);

  const values: ReviewValues = {
    rating: text(formData, "rating"),
    text: text(formData, "text"),
  };

  const route = await fetchRoute(routeDid, routeRkey);
  if (!route) {
    return { values, error: "This route no longer exists." };
  }

  const draft = reviewSchema.safeParse(values);
  if (!draft.success) {
    return { values, error: draft.error.issues[0].message };
  }

  const result = await saveReview(session, route, draft.data);
  if (!result.ok) {
    return { values, error: SAVE_ERROR_MESSAGES[result.reason] };
  }

  const notice = result.outcome === "created" ? "posted" : "updated";
  redirect(`${routePath}?notice=review-${notice}`);
}

export type DeleteReviewState = {
  error?: string;
};

const DELETE_ERROR_MESSAGES: Record<DeleteReviewError, string> = {
  "not-found": "You haven't reviewed this route.",
  "write-failed":
    "We couldn't delete your review from your account. Please try again.",
};

export async function deleteRouteReview(
  routeDid: string,
  routeRkey: string,
): Promise<DeleteReviewState> {
  const routePath = `/routes/${routeDid}/${routeRkey}`;
  const session = await assertSession(`${routePath}/review`);

  // Built from the URL rather than loaded, so reviews of deleted routes can
  // still be deleted.
  const subject = {
    uri: `at://${routeDid}/${app.attrails.route.$type}/${routeRkey}`,
  };
  const result = await deleteReview(session, subject);
  if (!result.ok) {
    return { error: DELETE_ERROR_MESSAGES[result.reason] };
  }

  redirect(`${routePath}?notice=review-deleted`);
}

function text(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

"use server";

import { Client, currentDatetimeString } from "@atproto/lex";
import { redirect } from "next/navigation";
import { loginHref } from "@/auth/login-href";
import { getSession } from "@/auth/session";
import { fetchUserReview } from "@/data/reviews";
import { fetchRoute } from "@/data/routes";
import { app } from "@/lexicons";

const { review } = app.attrails.v0;

export type ReviewValues = {
  rating: string;
  text: string;
};

export type ReviewState = {
  values: ReviewValues;
  error?: string;
};

export async function saveReview(
  routeDid: string,
  routeRkey: string,
  _previous: ReviewState,
  formData: FormData,
): Promise<ReviewState> {
  const session = await getSession();
  if (!session) {
    redirect(loginHref(`/routes/${routeDid}/${routeRkey}/review`));
  }

  const values: ReviewValues = {
    rating: text(formData, "rating"),
    text: text(formData, "text"),
  };

  const route = await fetchRoute(routeDid, routeRkey);
  if (!route) {
    return { values, error: "This route no longer exists." };
  }
  if (route.did === session.did) {
    return { values, error: "You can't review your own route." };
  }

  const rating = Number(values.rating);
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    return { values, error: "Choose a rating from 1 to 5 stars." };
  }
  if (!values.text) {
    return { values, error: "Write a few words about the route." };
  }

  const record = review.$safeValidate({
    $type: review.$type,
    subject: { uri: route.uri, cid: route.cid },
    rating,
    text: values.text,
    createdAt: currentDatetimeString(),
  });
  if (!record.success) {
    return { values, error: `Check your review: ${record.reason.message}` };
  }

  const client = new Client(session);
  let latest;
  try {
    latest = await fetchUserReview(route.uri, session.did);
    if (latest) {
      await client.put(review, record.value, { rkey: latest.rkey });
    } else {
      await client.create(review, record.value);
    }
  } catch (error) {
    console.warn(`reviews:save ${session.did} ${route.uri}`, error);
    return {
      values,
      error: "We couldn't save your review to your account. Please try again.",
    };
  }

  const notice = latest ? "review-updated" : "review-posted";
  redirect(`/routes/${route.did}/${route.rkey}?notice=${notice}`);
}

export type DeleteReviewState = {
  error?: string;
};

export async function deleteReview(
  routeDid: string,
  routeRkey: string,
  reviewRkey: string,
): Promise<DeleteReviewState> {
  const session = await getSession();
  if (!session) {
    redirect(loginHref(`/routes/${routeDid}/${routeRkey}/review`));
  }

  const client = new Client(session);
  try {
    await client.delete(review, { rkey: reviewRkey });
  } catch (error) {
    console.warn(`reviews:delete ${session.did} ${reviewRkey}`, error);
    return {
      error:
        "We couldn't delete your review from your account. Please try again.",
    };
  }

  redirect(`/routes/${routeDid}/${routeRkey}?notice=review-deleted`);
}

function text(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

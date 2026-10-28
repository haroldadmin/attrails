// Safe to import from client components. Server code imports `@/lib/reviews`.

import { z } from "zod";

/**
 * The record a review is about, as a strong reference. Reviews are of routes
 * for now, but nothing here depends on that.
 */
export type Subject = { uri: string; cid: string };

export type Review = {
  uri: string;
  cid: string;
  author: string;
  rating: number;
  /** `null` for reviews written without text by other apps. */
  text: string | null;
  createdAt: Temporal.Instant;
};

export type AuthoredReview = Review & { subject: Subject };

export type ReviewSummary = {
  count: number;
  /** `null` if there are no reviews. */
  averageRating: number | null;
};

/** `maxGraphemes` of `text` in the `app.attrails.review` lexicon. */
export const REVIEW_TEXT_MAX_GRAPHEMES = 3000;

const graphemes = new Intl.Segmenter();

function graphemeCount(text: string): number {
  return Array.from(graphemes.segment(text)).length;
}

const RATING_MESSAGE = "Choose a rating from 1 to 5 stars.";
const TEXT_MESSAGE = "Write a few words about it.";

/**
 * A review as the web app accepts it. Stricter than the lexicon, which lets
 * reviews leave out text.
 */
export const reviewSchema = z.object({
  rating: z.coerce
    .number({ error: RATING_MESSAGE })
    .int(RATING_MESSAGE)
    .min(1, RATING_MESSAGE)
    .max(5, RATING_MESSAGE),
  text: z
    .string({ error: TEXT_MESSAGE })
    .trim()
    .min(1, TEXT_MESSAGE)
    .refine(
      (text) => graphemeCount(text) <= REVIEW_TEXT_MAX_GRAPHEMES,
      `Keep it to ${REVIEW_TEXT_MAX_GRAPHEMES} characters.`,
    ),
});

export type ReviewDraft = z.output<typeof reviewSchema>;

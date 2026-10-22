"use client";

import { useActionState } from "react";
import type { ReviewState, ReviewValues } from "./actions";

const RATINGS = [1, 2, 3, 4, 5];

export type ReviewFormProps = {
  action: (previous: ReviewState, formData: FormData) => Promise<ReviewState>;
  initialValues: ReviewValues;
  /** Whether this edits the viewer's existing review. */
  isUpdate: boolean;
};

export function ReviewForm({
  action,
  initialValues,
  isUpdate,
}: ReviewFormProps) {
  const [state, formAction, pending] = useActionState(action, {
    values: initialValues,
  });
  const { values } = state;

  return (
    <form action={formAction} className="flex flex-col gap-4 max-w-prose">
      <fieldset className="fieldset">
        <legend className="fieldset-legend">Rating</legend>
        <div className="rating rating-lg">
          {RATINGS.map((rating) => (
            <input
              key={rating}
              type="radio"
              name="rating"
              value={rating}
              className="mask mask-star-2 bg-warning"
              aria-label={rating === 1 ? "1 star" : `${rating} stars`}
              defaultChecked={values.rating === String(rating)}
              required
            />
          ))}
        </div>
      </fieldset>

      <fieldset className="fieldset">
        <label className="fieldset-legend" htmlFor="review-text">
          Review
        </label>
        <textarea
          id="review-text"
          name="text"
          className="textarea w-full"
          rows={4}
          maxLength={3000}
          defaultValue={values.text}
          required
        />
        <p className="label">Up to 3,000 characters.</p>
      </fieldset>

      {state.error && (
        <p className="text-error" role="alert">
          {state.error}
        </p>
      )}

      <button
        type="submit"
        className="btn btn-neutral self-start"
        disabled={pending}
      >
        {pending ? "Saving…" : isUpdate ? "Update review" : "Post review"}
      </button>
    </form>
  );
}

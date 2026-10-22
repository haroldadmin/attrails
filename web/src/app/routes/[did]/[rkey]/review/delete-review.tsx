"use client";

import { useActionState, useRef } from "react";
import type { DeleteReviewState } from "./actions";

export type DeleteReviewProps = {
  action: () => Promise<DeleteReviewState>;
};

export function DeleteReview({ action }: DeleteReviewProps) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [state, formAction, pending] = useActionState(action, {});

  return (
    <>
      <button
        type="button"
        className="btn btn-error text-white self-start"
        onClick={() => dialog.current?.showModal()}
      >
        Delete review
      </button>

      <dialog
        ref={dialog}
        className="modal"
        aria-labelledby="delete-review-heading"
      >
        <div className="modal-box flex flex-col gap-4">
          <h2 id="delete-review-heading" className="text-lg font-semibold">
            Delete your review?
          </h2>
          <p>
            This deletes the review from your account. You can&apos;t undo this.
          </p>

          {state.error && (
            <p className="text-error" role="alert">
              {state.error}
            </p>
          )}

          <div className="modal-action">
            <form method="dialog">
              <button className="btn btn-ghost">Cancel</button>
            </form>
            <form action={formAction}>
              <button
                type="submit"
                className="btn btn-error"
                disabled={pending}
              >
                {pending ? "Deleting…" : "Delete"}
              </button>
            </form>
          </div>
        </div>
        <form method="dialog" className="modal-backdrop">
          <button>Close</button>
        </form>
      </dialog>
    </>
  );
}

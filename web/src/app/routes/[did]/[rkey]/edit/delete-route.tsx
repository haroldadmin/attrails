"use client";

import { useActionState, useRef } from "react";
import type { DeleteRouteState } from "./actions";

export type DeleteRouteProps = {
  action: () => Promise<DeleteRouteState>;
};

export function DeleteRoute({ action }: DeleteRouteProps) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [state, formAction, pending] = useActionState(action, {});

  return (
    <>
      <button
        type="button"
        className="btn btn-error text-white self-start"
        onClick={() => dialog.current?.showModal()}
      >
        Delete route
      </button>

      <dialog
        ref={dialog}
        className="modal"
        aria-labelledby="delete-route-heading"
      >
        <div className="modal-box flex flex-col gap-4">
          <h2 id="delete-route-heading" className="text-lg font-semibold">
            Delete this route?
          </h2>
          <p>
            This deletes the route and its GPX file from your account, and its
            reviews will no longer be shown. You can&apos;t undo this.
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

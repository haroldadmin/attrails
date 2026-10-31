"use server";

import { redirect } from "next/navigation";
import { assertSession } from "@/auth/session";
import {
  deleteRoute,
  type DeleteRouteError,
  routeSchema,
  saveRoute,
  type SaveRouteError,
} from "@/lib/routes";
import { readRouteValues, type RouteValues } from "../../../route-values";

export type EditRouteState = {
  values: RouteValues;
  error?: string;
};

const SAVE_ERROR_MESSAGES: Record<SaveRouteError, string> = {
  "not-owner": "You can only edit your own routes.",
  conflict:
    "This route has changed since you opened it. Reload the page and try again.",
  "not-found": "This route no longer exists.",
  invalid: "Check the route's details and try again.",
  "write-failed":
    "We couldn't save the route to your account. Please try again.",
};

/**
 * Saves the edited details over the route record. `cid` is the version of the
 * record the form was filled in from, so changes made since aren't overwritten.
 */
export async function saveRouteAction(
  did: string,
  rkey: string,
  cid: string,
  _previous: EditRouteState,
  formData: FormData,
): Promise<EditRouteState> {
  const session = await assertSession(`/routes/${did}/${rkey}/edit`);

  const values = readRouteValues(formData);
  const draft = routeSchema.safeParse(values);
  if (!draft.success) {
    return { values, error: draft.error.issues[0].message };
  }

  const result = await saveRoute(session, { did, rkey }, draft.data, {
    swapCid: cid,
  });
  if (!result.ok) {
    return { values, error: SAVE_ERROR_MESSAGES[result.reason] };
  }

  redirect(`/routes/${did}/${rkey}?notice=route-updated`);
}

export type DeleteRouteState = {
  error?: string;
};

const DELETE_ERROR_MESSAGES: Record<DeleteRouteError, string> = {
  "not-owner": "You can only delete your own routes.",
  "write-failed":
    "We couldn't delete the route from your account. Please try again.",
};

export async function deleteRouteAction(
  did: string,
  rkey: string,
): Promise<DeleteRouteState> {
  const session = await assertSession(`/routes/${did}/${rkey}/edit`);

  const result = await deleteRoute(session, { did, rkey });
  if (!result.ok) {
    return { error: DELETE_ERROR_MESSAGES[result.reason] };
  }

  redirect("/users/me?notice=route-deleted");
}

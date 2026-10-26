"use server";

import { Client, XrpcResponseError } from "@atproto/lex";
import { redirect } from "next/navigation";
import { loginHref } from "@/auth/login-href";
import { getSession } from "@/auth/session";
import { app } from "@/lexicons";
import {
  checkRouteValues,
  readRouteValues,
  routeDetails,
  type RouteValues,
} from "@/lib/route-form";
import { logger } from "@/lib/logger";

const { route } = app.attrails;

export type EditRouteState = {
  values: RouteValues;
  error?: string;
};

/**
 * Saves the edited details over the route record. `cid` is the version of the
 * record the form was filled in from, so changes made since aren't overwritten.
 */
export async function saveRoute(
  did: string,
  rkey: string,
  cid: string,
  _previous: EditRouteState,
  formData: FormData,
): Promise<EditRouteState> {
  const session = await getSession();
  if (!session) {
    redirect(loginHref(`/routes/${did}/${rkey}/edit`));
  }

  const values = readRouteValues(formData);
  if (did !== session.did) {
    return { values, error: "You can only edit your own routes." };
  }

  const error = checkRouteValues(values);
  if (error) {
    return { values, error };
  }

  const client = new Client(session);
  try {
    // The form doesn't cover every field of the record, such as the track,
    // so the rest are kept from the record as it is now.
    const current = await client.get(route, { rkey });
    const record = route.$safeValidate({
      ...current.value,
      ...routeDetails(values),
    });
    if (!record.success) {
      return {
        values,
        error: `Check the route's details: ${record.reason.message}`,
      };
    }

    await client.put(route, record.value, { rkey, swapRecord: cid });
  } catch (error) {
    if (error instanceof XrpcResponseError) {
      if (error.error === "InvalidSwap") {
        return {
          values,
          error:
            "This route has changed since you opened it. Reload the page and try again.",
        };
      }
      if (error.error === "RecordNotFound") {
        return { values, error: "This route no longer exists." };
      }
    }

    logger.warn({ err: error, did: session.did, rkey }, "routes:edit");
    return {
      values,
      error: "We couldn't save the route to your account. Please try again.",
    };
  }

  redirect(`/routes/${did}/${rkey}?notice=route-updated`);
}

export type DeleteRouteState = {
  error?: string;
};

export async function deleteRoute(
  did: string,
  rkey: string,
): Promise<DeleteRouteState> {
  const session = await getSession();
  if (!session) {
    redirect(loginHref(`/routes/${did}/${rkey}/edit`));
  }
  if (did !== session.did) {
    return { error: "You can only delete your own routes." };
  }

  const client = new Client(session);
  try {
    await client.delete(route, { rkey });
  } catch (error) {
    logger.warn({ err: error, did: session.did, rkey }, "routes:delete");
    return {
      error:
        "We couldn't delete the route from your account. Please try again.",
    };
  }

  redirect("/users/me?notice=route-deleted");
}

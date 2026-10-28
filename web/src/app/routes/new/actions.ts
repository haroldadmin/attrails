"use server";

import { redirect } from "next/navigation";
import { assertSession } from "@/auth/session";
import { GPX_MAX_SIZE_BYTES, GpxError, parseGpx } from "@/lib/gpx";
import { createRoute, type CreateRouteError, routeSchema } from "@/lib/routes";
import { readRouteValues, type RouteValues } from "../route-values";
import { GPX_TOO_LARGE_MESSAGE, gpxErrorMessage } from "./gpx-messages";

export type UploadRouteState = {
  values: RouteValues;
  error?: string;
};

const CREATE_ERROR_MESSAGES: Record<CreateRouteError, string> = {
  invalid: "Check the route's details and try again.",
  "write-failed":
    "We couldn't save the route to your account. Please try again.",
};

export async function uploadRoute(
  _previous: UploadRouteState,
  formData: FormData,
): Promise<UploadRouteState> {
  const session = await assertSession("/routes/new");

  const values = readRouteValues(formData);
  const draft = routeSchema.safeParse(values);
  if (!draft.success) {
    return { values, error: draft.error.issues[0].message };
  }

  const file = formData.get("gpx");
  if (!(file instanceof File) || file.size === 0) {
    return { values, error: "Choose a GPX file." };
  }
  if (file.size > GPX_MAX_SIZE_BYTES) {
    return { values, error: GPX_TOO_LARGE_MESSAGE };
  }

  const gpx = new Uint8Array(await file.arrayBuffer());
  try {
    parseGpx(new TextDecoder().decode(gpx));
  } catch (error) {
    if (error instanceof GpxError) {
      return { values, error: gpxErrorMessage(error.reason) };
    }
    throw error;
  }

  const result = await createRoute(session, draft.data, gpx);
  if (!result.ok) {
    return { values, error: CREATE_ERROR_MESSAGES[result.reason] };
  }

  redirect("/?notice=route-uploaded");
}

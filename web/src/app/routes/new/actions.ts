"use server";

import { Client, currentDatetimeString } from "@atproto/lex";
import { redirect } from "next/navigation";
import { loginHref } from "@/auth/login-href";
import { getSession } from "@/auth/session";
import { app } from "@/lexicons";
import { GPX_MAX_SIZE_BYTES, GpxError, parseGpx } from "@/lib/gpx";
import {
  checkRouteValues,
  readRouteValues,
  routeDetails,
  type RouteValues,
} from "@/lib/route-form";
import { logger } from "@/lib/logger";
import { GPX_TOO_LARGE_MESSAGE, gpxErrorMessage } from "./gpx-messages";

const { route } = app.attrails;

const GPX_ENCODING = "application/gpx+xml";

export type UploadRouteState = {
  values: RouteValues;
  error?: string;
};

export async function uploadRoute(
  _previous: UploadRouteState,
  formData: FormData,
): Promise<UploadRouteState> {
  const session = await getSession();
  if (!session) {
    redirect(loginHref("/routes/new"));
  }

  const values = readRouteValues(formData);
  const error = checkRouteValues(values);
  if (error) {
    return { values, error };
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

  const client = new Client(session);
  try {
    const { body } = await client.uploadBlob(gpx, { encoding: GPX_ENCODING });

    const record = route.$safeValidate(
      route.$build({
        ...routeDetails(values),
        track: body.blob,
        createdAt: currentDatetimeString(),
      }),
    );
    // The PDS deletes the uploaded blob on its own once nothing references it.
    if (!record.success) {
      return {
        values,
        error: `Check the route's details: ${record.reason.message}`,
      };
    }

    await client.create(route, record.value);
  } catch (error) {
    logger.warn({ err: error, did: session.did }, "routes:upload");
    return {
      values,
      error: "We couldn't save the route to your account. Please try again.",
    };
  }

  redirect("/?notice=route-uploaded");
}

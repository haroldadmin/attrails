"use server";

import { Client, currentDatetimeString } from "@atproto/lex";
import { DOMParser, onErrorStopParsing } from "@xmldom/xmldom";
import { redirect } from "next/navigation";
import { loginHref } from "@/auth/login-href";
import { getSession } from "@/auth/session";
import { app } from "@/lexicons";
import { GPX_MAX_SIZE_BYTES, hasGpxTrack } from "@/lib/gpx";
import {
  checkRouteValues,
  readRouteValues,
  routeDetails,
  type RouteValues,
} from "@/lib/route-form";

const { route } = app.attrails.v0;

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
    return {
      values,
      error: "That GPX file is too large. The limit is 976 KB.",
    };
  }

  const gpx = new Uint8Array(await file.arrayBuffer());
  if (!isUsableGpx(gpx)) {
    return {
      values,
      error: "That file isn't a GPX file with a track or route in it.",
    };
  }

  const client = new Client(session);
  try {
    const { body } = await client.uploadBlob(gpx, { encoding: GPX_ENCODING });

    const record = route.$safeValidate(
      route.$build({
        ...routeDetails(values),
        gpx: body.blob,
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
    console.warn(`routes:upload ${session.did}`, error);
    return {
      values,
      error: "We couldn't save the route to your account. Please try again.",
    };
  }

  redirect("/?notice=route-uploaded");
}

function isUsableGpx(gpx: Uint8Array): boolean {
  try {
    const doc = new DOMParser({ onError: onErrorStopParsing }).parseFromString(
      new TextDecoder().decode(gpx),
      "application/xml",
    );
    return hasGpxTrack(doc);
  } catch {
    return false;
  }
}

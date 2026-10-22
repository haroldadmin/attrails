"use client";

import { useActionState } from "react";
import { RouteFields } from "@/components/route-fields";
import type { Option } from "@/lib/labels";
import { uploadRoute, type UploadRouteState } from "./actions";

const initialState: UploadRouteState = {
  values: {
    name: "",
    description: "",
    activity: "",
    surface: "",
    difficulty: "",
    tags: "",
  },
};

export type UploadRouteFormProps = {
  activities: readonly Option[];
  surfaces: readonly Option[];
  difficulties: readonly Option[];
};

export function UploadRouteForm({
  activities,
  surfaces,
  difficulties,
}: UploadRouteFormProps) {
  const [state, formAction, pending] = useActionState(
    uploadRoute,
    initialState,
  );
  const { values } = state;

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <fieldset className="fieldset">
        <label className="fieldset-legend" htmlFor="gpx">
          GPX file
        </label>
        <input
          id="gpx"
          name="gpx"
          type="file"
          className="file-input w-full"
          accept=".gpx,application/gpx+xml"
          required
        />
        <p className="label">Up to 976 KB.</p>
      </fieldset>

      <RouteFields
        values={values}
        activities={activities}
        surfaces={surfaces}
        difficulties={difficulties}
      />

      {state.error && (
        <p className="text-error" role="alert">
          {state.error}
        </p>
      )}

      <button type="submit" className="btn btn-primary" disabled={pending}>
        {pending ? "Uploading…" : "Upload route"}
      </button>
    </form>
  );
}

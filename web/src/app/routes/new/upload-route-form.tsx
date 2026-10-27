"use client";

import dynamic from "next/dynamic";
import { useActionState, useRef, useState } from "react";
import { RouteFields } from "@/components/route-fields";
import type { Units } from "@/i18n/units";
import { type Gpx, gpxName } from "@/lib/gpx";
import type { Option } from "@/lib/labels";
import { uploadRoute, type UploadRouteState } from "./actions";
import { GpxFileInput } from "./gpx-file-input";

const GpxPreview = dynamic(() => import("./gpx-preview"), { ssr: false });

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
  locale: string;
  units: Units;
};

export function UploadRouteForm({
  activities,
  surfaces,
  difficulties,
  locale,
  units,
}: UploadRouteFormProps) {
  const [state, formAction, pending] = useActionState(
    uploadRoute,
    initialState,
  );
  const formRef = useRef<HTMLFormElement>(null);
  const [gpx, setGpx] = useState<Gpx | null>(null);

  function handleGpxChange(gpx: Gpx | null) {
    setGpx(gpx);

    const name = formRef.current?.elements.namedItem("name");
    const routeName = gpx && gpxName(gpx);
    if (name instanceof HTMLInputElement && !name.value && routeName) {
      name.value = routeName.slice(0, name.maxLength);
    }
  }

  return (
    <form ref={formRef} action={formAction} className="flex flex-col gap-4">
      <GpxFileInput onChange={handleGpxChange} />

      {gpx && <GpxPreview gpx={gpx} locale={locale} units={units} />}

      <RouteFields
        values={state.values}
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

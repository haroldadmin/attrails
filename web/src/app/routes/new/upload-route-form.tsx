"use client";

import dynamic from "next/dynamic";
import {
  type FormEvent,
  startTransition,
  useActionState,
  useRef,
  useState,
} from "react";
import { RouteFields } from "@/components/route-fields";
import type { Units } from "@/i18n/units";
import { type Gpx, gpxName } from "@/lib/gpx";
import type { Option } from "@/lib/routes/shared";
import { uploadRoute, type UploadRouteState } from "./actions";
import { GpxFileInput } from "./gpx-file-input";

const GpxPreview = dynamic(() => import("./gpx-preview"), {
  ssr: false,
  loading: () => <div className="h-80 rounded-box bg-base-200 lg:h-96" />,
});

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

  // Submitting through `onSubmit` stops React from resetting the form after the
  // action, so the chosen file and preview survive an error from the server.
  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    startTransition(() => formAction(formData));
  }

  return (
    <form
      ref={formRef}
      action={formAction}
      onSubmit={handleSubmit}
      className="grid gap-8 lg:grid-cols-2 lg:grid-rows-[auto_1fr] lg:items-start lg:gap-x-12 lg:gap-y-4"
    >
      <div className="flex flex-col gap-4">
        <RouteFields
          values={state.values}
          activities={activities}
          surfaces={surfaces}
          difficulties={difficulties}
        />
      </div>

      <div className="flex flex-col gap-4 lg:sticky lg:top-8 lg:col-start-2 lg:row-span-2 lg:row-start-1">
        <GpxFileInput onChange={handleGpxChange} />
        {gpx && <GpxPreview gpx={gpx} locale={locale} units={units} />}
      </div>

      <div className="flex flex-col gap-4">
        {state.error && (
          <p className="text-error" role="alert">
            {state.error}
          </p>
        )}

        <button type="submit" className="btn btn-primary" disabled={pending}>
          {pending ? "Uploading…" : "Upload route"}
        </button>
      </div>
    </form>
  );
}

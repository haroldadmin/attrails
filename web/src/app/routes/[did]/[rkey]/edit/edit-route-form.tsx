"use client";

import { useActionState } from "react";
import { RouteFields } from "@/components/route-fields";
import type { Option, RouteImage } from "@/lib/routes/shared";
import { PhotosInput } from "../../../photos/photos-input";
import type { UploadPhoto } from "../../../photos/use-photo-uploads";
import type { RouteValues } from "../../../route-values";
import type { EditRouteState } from "./actions";

export type EditRouteFormProps = {
  action: (
    previous: EditRouteState,
    formData: FormData,
  ) => Promise<EditRouteState>;
  uploadPhoto: UploadPhoto;
  initialValues: RouteValues;
  initialPhotos: readonly RouteImage[];
  /** Shows saved photos as they are, without `next/image` optimising them. */
  unoptimizedPhotos: boolean;
  activities: readonly Option[];
  surfaces: readonly Option[];
  difficulties: readonly Option[];
};

export function EditRouteForm({
  action,
  uploadPhoto,
  initialValues,
  initialPhotos,
  unoptimizedPhotos,
  activities,
  surfaces,
  difficulties,
}: EditRouteFormProps) {
  const [state, formAction, pending] = useActionState(action, {
    values: initialValues,
  });

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <RouteFields
        values={state.values}
        activities={activities}
        surfaces={surfaces}
        difficulties={difficulties}
        afterActivity={
          <PhotosInput
            upload={uploadPhoto}
            initialPhotos={initialPhotos}
            unoptimized={unoptimizedPhotos}
          />
        }
      />

      {state.error && (
        <p className="text-error" role="alert">
          {state.error}
        </p>
      )}

      <button type="submit" className="btn btn-primary" disabled={pending}>
        {pending ? "Saving…" : "Save changes"}
      </button>
    </form>
  );
}

"use client";

import { useActionState } from "react";
import { RouteFields } from "@/components/route-fields";
import type { Option } from "@/lib/routes/shared";
import type { RouteValues } from "../../../route-values";
import type { EditRouteState } from "./actions";

export type EditRouteFormProps = {
  action: (
    previous: EditRouteState,
    formData: FormData,
  ) => Promise<EditRouteState>;
  initialValues: RouteValues;
  activities: readonly Option[];
  surfaces: readonly Option[];
  difficulties: readonly Option[];
};

export function EditRouteForm({
  action,
  initialValues,
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

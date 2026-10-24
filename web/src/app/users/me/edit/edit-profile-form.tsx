"use client";

import { useActionState } from "react";
import type { EditProfileState, ProfileValues } from "./actions";

export type EditProfileFormProps = {
  action: (
    previous: EditProfileState,
    formData: FormData,
  ) => Promise<EditProfileState>;
  initialValues: ProfileValues;
};

export function EditProfileForm({
  action,
  initialValues,
}: EditProfileFormProps) {
  const [state, formAction, pending] = useActionState(action, {
    values: initialValues,
  });
  const { values } = state;

  return (
    <form action={formAction} className="flex flex-col gap-4 max-w-prose">
      <fieldset className="fieldset">
        <label className="fieldset-legend" htmlFor="profile-name">
          Name
        </label>
        <input
          id="profile-name"
          name="name"
          type="text"
          className="input w-full"
          maxLength={100}
          autoComplete="nickname"
          aria-describedby="profile-name-hint"
          defaultValue={values.name}
          required
        />
        <p id="profile-name-hint" className="label">
          Up to 100 characters.
        </p>
      </fieldset>

      <fieldset className="fieldset">
        <label className="fieldset-legend" htmlFor="profile-bio">
          Bio <span className="font-normal">(optional)</span>
        </label>
        <textarea
          id="profile-bio"
          name="bio"
          className="textarea w-full"
          rows={6}
          maxLength={3000}
          aria-describedby="profile-bio-hint"
          defaultValue={values.bio}
        />
        <p id="profile-bio-hint" className="label">
          Up to 3,000 characters.
        </p>
      </fieldset>

      {state.error && (
        <p className="text-error" role="alert">
          {state.error}
        </p>
      )}

      <button
        type="submit"
        className="btn btn-primary self-start"
        disabled={pending}
      >
        {pending ? "Saving…" : "Save changes"}
      </button>
    </form>
  );
}

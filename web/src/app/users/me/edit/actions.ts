"use server";

import { redirect } from "next/navigation";
import { assertSession } from "@/auth/session";
import {
  profileSchema,
  saveProfile,
  type SaveProfileError,
} from "@/lib/profiles";

export type ProfileValues = {
  name: string;
  bio: string;
};

export type EditProfileState = {
  values: ProfileValues;
  error?: string;
};

const SAVE_ERROR_MESSAGES: Record<SaveProfileError, string> = {
  conflict:
    "Your profile has changed since you opened this page. Reload the page and try again.",
  "not-found": "Your profile no longer exists.",
  invalid: "Check your profile and try again.",
  "write-failed":
    "We couldn't save your profile to your account. Please try again.",
};

/**
 * Saves the edited details over the profile record. `cid` is the version of the
 * record the form was filled in from, so changes made since aren't overwritten.
 */
export async function saveProfileAction(
  cid: string | null,
  _previous: EditProfileState,
  formData: FormData,
): Promise<EditProfileState> {
  const session = await assertSession("/users/me/edit");

  const values: ProfileValues = {
    name: text(formData, "name"),
    bio: text(formData, "bio"),
  };

  const draft = profileSchema.safeParse(values);
  if (!draft.success) {
    return { values, error: draft.error.issues[0].message };
  }

  const result = await saveProfile(session, draft.data, { swapCid: cid });
  if (!result.ok) {
    return { values, error: SAVE_ERROR_MESSAGES[result.reason] };
  }

  redirect("/users/me?notice=profile-updated");
}

function text(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

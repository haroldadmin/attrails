"use server";

import { Client, XrpcResponseError } from "@atproto/lex";
import { redirect } from "next/navigation";
import { loginHref } from "@/auth/login-href";
import { getSession } from "@/auth/session";
import { app } from "@/lexicons";

const { profile } = app.attrails.actor;

export type ProfileValues = {
  name: string;
  bio: string;
};

export type EditProfileState = {
  values: ProfileValues;
  error?: string;
};

/**
 * Saves the edited details over the profile record. `cid` is the version of the
 * record the form was filled in from, so changes made since aren't overwritten.
 */
export async function saveProfile(
  cid: string | undefined,
  _previous: EditProfileState,
  formData: FormData,
): Promise<EditProfileState> {
  const session = await getSession();
  if (!session) {
    redirect(loginHref("/users/me/edit"));
  }

  const values: ProfileValues = {
    name: text(formData, "name"),
    bio: text(formData, "bio"),
  };

  if (!values.name) {
    return { values, error: "Give your profile a name." };
  }

  const client = new Client(session);
  try {
    // The form doesn't cover every field of the record, such as the profile
    // picture, so the rest are kept from the record as it is now.
    const current = await client.get(profile);
    const record = profile.$safeValidate({
      ...current.value,
      name: values.name,
      bio: values.bio || undefined,
    });
    if (!record.success) {
      return {
        values,
        error: `Check your profile: ${record.reason.message}`,
      };
    }

    await client.put(profile, record.value, { swapRecord: cid });
  } catch (error) {
    if (error instanceof XrpcResponseError) {
      if (error.error === "InvalidSwap") {
        return {
          values,
          error:
            "Your profile has changed since you opened this page. Reload the page and try again.",
        };
      }
      if (error.error === "RecordNotFound") {
        return { values, error: "Your profile no longer exists." };
      }
    }

    console.warn(`profiles:edit ${session.did}`, error);
    return {
      values,
      error: "We couldn't save your profile to your account. Please try again.",
    };
  }

  redirect("/users/me?notice=profile-updated");
}

function text(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

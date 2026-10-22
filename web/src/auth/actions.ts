"use server";

import { redirect } from "next/navigation";
import { getOAuthClient, OAUTH_SCOPE } from "./client";
import { safeReturnTo } from "./return-to";
import { endWebSession } from "./session";

export type LoginState = {
  handle: string;
  error?: string;
};

export async function login(
  _previous: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const input = formData.get("handle");
  const handle =
    typeof input === "string" ? input.trim().replace(/^@/, "") : "";
  if (!handle) {
    return { handle, error: "Enter your handle to log in." };
  }

  let authorizeUrl: URL;
  try {
    authorizeUrl = await getOAuthClient().authorize(handle, {
      scope: OAUTH_SCOPE,
      state: safeReturnTo(formData.get("returnTo")),
    });
  } catch (error) {
    console.warn(`auth:authorize ${handle}`, error);
    return {
      handle,
      error: "We couldn't find that account. Check the handle and try again.",
    };
  }

  redirect(authorizeUrl.href);
}

export async function logout(): Promise<void> {
  await endWebSession();
  redirect("/");
}

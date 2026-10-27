"use client";

import { useSearchParams } from "next/navigation";
import { useActionState } from "react";
import { login, type LoginState } from "@/auth/actions";
import { HandleField } from "./handle-field";

const callbackErrors: Record<string, string> = {
  callback: "Logging in didn't finish. Please try again.",
};

export function LoginForm() {
  const [state, formAction, pending] = useActionState<LoginState, FormData>(
    login,
    { handle: "" },
  );
  const searchParams = useSearchParams();
  const callbackError = callbackErrors[searchParams.get("error") ?? ""];
  const error = state.error ?? callbackError;

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input
        type="hidden"
        name="returnTo"
        value={searchParams.get("returnTo") ?? ""}
      />
      <fieldset className="fieldset">
        <label className="fieldset-legend" htmlFor="handle">
          Handle
        </label>
        <HandleField defaultValue={state.handle} />
        {error && (
          <p className="text-error" role="alert">
            {error}
          </p>
        )}
      </fieldset>
      <button type="submit" className="btn btn-primary" disabled={pending}>
        {pending ? "Redirecting…" : "Log in"}
      </button>
    </form>
  );
}

"use client";

import { useSearchParams } from "next/navigation";
import { useActionState } from "react";
import { login, type LoginState } from "@/auth/actions";

const callbackErrors: Record<string, string> = {
  callback: "Logging in didn't finish. Please try again.",
};

export function LoginForm() {
  const [state, formAction, pending] = useActionState<LoginState, FormData>(
    login,
    { handle: "" },
  );
  const callbackError = callbackErrors[useSearchParams().get("error") ?? ""];
  const error = state.error ?? callbackError;

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <fieldset className="fieldset">
        <label className="fieldset-legend" htmlFor="handle">
          Handle
        </label>
        <input
          id="handle"
          name="handle"
          type="text"
          className="input w-full"
          placeholder="alice.bsky.social"
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          defaultValue={state.handle}
          required
        />
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

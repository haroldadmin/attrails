import type { Metadata } from "next";
import { Suspense } from "react";
import { LoginForm } from "./login-form";

export const metadata: Metadata = {
  title: "Log in",
  robots: { index: false },
};

export default function LoginPage() {
  return (
    <main className="flex flex-col gap-6 w-full max-w-md mx-auto px-4 py-8 sm:py-16">
      <h1 className="font-serif text-4xl">Log in</h1>
      <p>
        Use your Bluesky handle, or the handle of any other account on the AT
        Protocol.
      </p>
      <Suspense>
        <LoginForm />
      </Suspense>
    </main>
  );
}

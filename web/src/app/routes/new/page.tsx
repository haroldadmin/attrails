import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { loginHref } from "@/auth/login-href";
import { getSession } from "@/auth/session";
import { ACTIVITIES, DIFFICULTIES, SURFACES } from "@/lib/labels";
import { UploadRouteForm } from "./upload-route-form";

export const metadata: Metadata = {
  title: "Upload a route · ATTrails",
};

export default function NewRoutePage() {
  return (
    <main className="flex flex-col gap-6 w-full max-w-2xl mx-auto px-4 py-8 sm:py-16">
      <h1 className="font-serif text-4xl">Upload a route</h1>
      <p>
        Your route is saved to your account as a GPX file, and shows up on
        ATTrails once it has been processed.
      </p>
      <Suspense>
        <SignedInUploadForm />
      </Suspense>
    </main>
  );
}

async function SignedInUploadForm() {
  const session = await getSession();
  if (!session) {
    redirect(loginHref("/routes/new"));
  }

  return (
    <UploadRouteForm
      activities={ACTIVITIES}
      surfaces={SURFACES}
      difficulties={DIFFICULTIES}
    />
  );
}

import { Client, XrpcResponseError } from "@atproto/lex";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { loginHref } from "@/auth/login-href";
import { getSession } from "@/auth/session";
import { app } from "@/lexicons";
import { saveProfile } from "./actions";
import { EditProfileForm } from "./edit-profile-form";

export const metadata: Metadata = {
  title: "Edit your profile",
};

export default function EditProfilePage() {
  return (
    <main className="flex flex-col gap-6 w-full max-w-2xl mx-auto px-4 py-8 sm:py-16">
      <h1 className="font-serif text-4xl">Edit your profile</h1>
      <p>
        Your name and bio are saved to your account as a public record. Changes
        show up on ATTrails once they have been processed.
      </p>
      <Suspense>
        <EditProfile />
      </Suspense>
    </main>
  );
}

async function EditProfile() {
  const session = await getSession();
  if (!session) {
    redirect(loginHref("/users/me/edit"));
  }

  // Read from the PDS rather than Postgres so the form starts from the latest
  // saved values, even before ingestion has caught up.
  const current = await fetchCurrentProfile(new Client(session));

  return (
    <EditProfileForm
      action={saveProfile.bind(null, current.cid)}
      initialValues={{
        name: current.value.name,
        bio: current.value.bio ?? "",
      }}
    />
  );
}

async function fetchCurrentProfile(client: Client) {
  try {
    return await client.get(app.attrails.actor.profile);
  } catch (error) {
    if (
      error instanceof XrpcResponseError &&
      error.error === "RecordNotFound"
    ) {
      redirect("/users/me");
    }
    throw error;
  }
}

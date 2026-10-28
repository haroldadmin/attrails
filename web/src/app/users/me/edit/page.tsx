import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { assertSession } from "@/auth/session";
import { fetchProfileRecord } from "@/lib/profiles";
import { saveProfileAction } from "./actions";
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
  const session = await assertSession("/users/me/edit");

  const current = await fetchProfileRecord(session);
  if (!current) {
    redirect("/users/me");
  }

  return (
    <EditProfileForm
      action={saveProfileAction.bind(null, current.cid)}
      initialValues={{ name: current.name, bio: current.bio ?? "" }}
    />
  );
}

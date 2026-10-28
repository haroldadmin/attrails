import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { logout } from "@/auth/actions";
import { loginHref } from "@/auth/login-href";
import { getSession } from "@/auth/session";
import { Notice } from "@/components/notice";
import {
  ProfileHeader,
  ProfileHeaderSkeleton,
} from "@/components/profile-header";
import { fetchProfile } from "@/lib/profiles";
import { fetchReviewList, fetchRouteList } from "../listings";
import { RouteList, RouteListSkeleton } from "../route-list";
import { loadRoutes } from "./actions";
import { ReviewList } from "./review-list";

export const metadata: Metadata = {
  title: "Your profile",
};

export default function ProfilePage() {
  return (
    <main className="flex flex-col gap-12 px-4 py-8 sm:p-16">
      <Suspense fallback={<ProfileHeaderSkeleton />}>
        <Profile />
      </Suspense>
    </main>
  );
}

async function Profile() {
  const session = await getSession();
  if (!session) {
    redirect(loginHref("/users/me"));
  }

  const profile = await fetchProfile(session.did);

  return (
    <>
      <Suspense>
        <Notice
          messages={{
            "profile-updated":
              "Profile updated. It'll show up across ATTrails once it has been processed.",
            "route-deleted":
              "Route deleted. It'll disappear from your routes once it has been processed.",
          }}
        />
      </Suspense>

      <ProfileHeader profile={profile}>
        <div className="flex flex-row gap-3">
          <Link href="/users/me/edit" className="btn btn-outline btn-sm">
            Edit profile
          </Link>
          <form action={logout}>
            <button type="submit" className="btn btn-ghost btn-sm">
              Log out
            </button>
          </form>
        </div>
      </ProfileHeader>

      <section aria-labelledby="routes-heading" className="flex flex-col gap-6">
        <h2 id="routes-heading" className="font-serif text-3xl">
          Your routes
        </h2>
        <Suspense fallback={<RouteListSkeleton />}>
          <YourRoutes did={session.did} />
        </Suspense>
      </section>

      <section
        aria-labelledby="reviews-heading"
        className="flex flex-col gap-6"
      >
        <h2 id="reviews-heading" className="font-serif text-3xl">
          Your reviews
        </h2>
        <Suspense fallback={<ReviewsSkeleton />}>
          <YourReviews did={session.did} />
        </Suspense>
      </section>
    </>
  );
}

async function YourRoutes({ did }: { did: string }) {
  const firstPage = await fetchRouteList(did);
  if (firstPage.items.length === 0) {
    return (
      <p>
        You haven&apos;t uploaded any routes yet.{" "}
        <Link href="/routes/new" className="link">
          Upload a route
        </Link>
        .
      </p>
    );
  }

  return <RouteList firstPage={firstPage} load={loadRoutes} editable />;
}

async function YourReviews({ did }: { did: string }) {
  const firstPage = await fetchReviewList(did);
  if (firstPage.items.length === 0) {
    return <p>You haven&apos;t reviewed any routes yet.</p>;
  }

  return <ReviewList firstPage={firstPage} />;
}

function ReviewsSkeleton() {
  return (
    <div className="flex flex-col gap-8 max-w-prose" aria-hidden="true">
      {Array.from({ length: 3 }, (_, i) => (
        <div key={i} className="flex flex-col gap-2">
          <div className="skeleton h-7 w-1/2" />
          <div className="skeleton h-4 w-24" />
          <div className="skeleton h-16 w-full" />
        </div>
      ))}
    </div>
  );
}

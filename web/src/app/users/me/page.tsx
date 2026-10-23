import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { loginHref } from "@/auth/login-href";
import { getSession } from "@/auth/session";
import { Avatar, profileName } from "@/components/author";
import { Notice } from "@/components/notice";
import { fetchAuthorProfile } from "@/lib/profiles";
import { fetchReviewList, fetchRouteList } from "./listings";
import { ReviewList } from "./review-list";
import { RouteList } from "./route-list";

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

  const profile = await fetchAuthorProfile(session.did);

  return (
    <>
      <header className="flex flex-col gap-4">
        <div className="flex flex-row items-center gap-4">
          <Avatar profile={profile} size="lg" />
          <div className="flex flex-col min-w-0">
            <h1 className="font-serif text-4xl truncate">
              {profileName(profile)}
            </h1>
            {profile.displayName && profile.handle && (
              <p className="text-base-content/70 truncate">@{profile.handle}</p>
            )}
          </div>
        </div>
        {profile.bio && (
          <p className="max-w-prose whitespace-pre-line">{profile.bio}</p>
        )}
      </header>

      <section aria-labelledby="routes-heading" className="flex flex-col gap-6">
        <h2 id="routes-heading" className="font-serif text-3xl">
          Your routes
        </h2>
        <Suspense>
          <Notice
            messages={{
              "route-deleted":
                "Route deleted. It'll disappear from your routes once that has been processed.",
            }}
          />
        </Suspense>
        <Suspense fallback={<RoutesSkeleton />}>
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

  return <RouteList firstPage={firstPage} />;
}

async function YourReviews({ did }: { did: string }) {
  const firstPage = await fetchReviewList(did);
  if (firstPage.items.length === 0) {
    return <p>You haven&apos;t reviewed any routes yet.</p>;
  }

  return <ReviewList firstPage={firstPage} />;
}

function ProfileHeaderSkeleton() {
  return (
    <div className="flex flex-row items-center gap-4" aria-hidden="true">
      <div className="skeleton size-20 rounded-full shrink-0" />
      <div className="skeleton h-10 w-64" />
    </div>
  );
}

function RoutesSkeleton() {
  return (
    <div
      className="flex flex-col divide-y divide-base-300 max-w-prose"
      aria-hidden="true"
    >
      {Array.from({ length: 3 }, (_, i) => (
        <div key={i} className="py-3">
          <div className="skeleton h-5 w-2/3" />
        </div>
      ))}
    </div>
  );
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

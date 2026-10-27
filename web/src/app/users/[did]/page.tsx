import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { getWebUrl } from "@/auth/client";
import { getSession } from "@/auth/session";
import { JsonLd } from "@/components/json-ld";
import {
  ProfileHeader,
  ProfileHeaderSkeleton,
} from "@/components/profile-header";
import { profileName } from "@/lib/profile-name";
import { type AuthorProfile, fetchUserProfile } from "@/lib/profiles";
import { profileJsonLd } from "@/lib/structured-data";
import { fetchRouteList } from "../listings";
import { RouteList, RouteListSkeleton } from "../route-list";
import { loadUserRoutes } from "./actions";

type UserPageProps = PageProps<"/users/[did]">;

export async function generateMetadata({
  params,
}: UserPageProps): Promise<Metadata> {
  const { did } = await params;
  const profile = await fetchUserProfile(decodeURIComponent(did));
  if (!profile) {
    notFound();
  }

  return {
    metadataBase: getWebUrl(),
    title: profileName(profile),
    alternates: { canonical: `/users/${profile.did}` },
  };
}

export default function UserPage({ params }: UserPageProps) {
  return (
    <main className="flex flex-col gap-12 px-4 py-8 sm:p-16">
      <Suspense fallback={<ProfileHeaderSkeleton />}>
        <Profile params={params} />
      </Suspense>
    </main>
  );
}

async function Profile({ params }: Pick<UserPageProps, "params">) {
  const { did: encodedDid } = await params;
  const did = decodeURIComponent(encodedDid);

  const [session, profile] = await Promise.all([
    getSession(),
    fetchUserProfile(did),
  ]);
  if (session?.did === did) {
    redirect("/users/me");
  }
  if (!profile) {
    notFound();
  }

  return (
    <>
      <JsonLd data={profileJsonLd(profile)} />
      <ProfileHeader profile={profile} />

      <section aria-labelledby="routes-heading" className="flex flex-col gap-6">
        <h2 id="routes-heading" className="font-serif text-3xl">
          Routes
        </h2>
        <Suspense fallback={<RouteListSkeleton />}>
          <UserRoutes profile={profile} />
        </Suspense>
      </section>
    </>
  );
}

async function UserRoutes({ profile }: { profile: AuthorProfile }) {
  const firstPage = await fetchRouteList(profile.did, { hideLabelled: true });
  if (firstPage.items.length === 0) {
    return <p>{profileName(profile)} hasn&apos;t shared any routes yet.</p>;
  }

  return (
    <RouteList
      firstPage={firstPage}
      load={loadUserRoutes.bind(null, profile.did)}
    />
  );
}

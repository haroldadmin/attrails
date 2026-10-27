import clsx from "clsx";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { RouteGrid, RouteGridSkeleton } from "@/components/route-grid";
import {
  ACTIVITY_FILTERS,
  activityFromSlug,
  activityLabel,
  activitySlug,
  DEFAULT_ACTIVITY,
} from "@/lib/labels";
import { fetchRoutesPage } from "@/lib/routes";

export const metadata: Metadata = {
  title: "All routes",
  description: "All the adventures you can find on ATTrails.",
};

// Fills both grid layouts (2 and 3 columns).
const ROUTES_PAGE_SIZE = 12;

export default function AllRoutesPage({ searchParams }: PageProps<"/routes">) {
  return (
    <main className="flex flex-col gap-8 px-4 py-8 sm:p-16">
      <hgroup className="flex flex-col gap-2">
        <h1 className="font-serif text-4xl">All routes</h1>
        <p className="text-base-content/70">
          All the adventures you can find on ATTrails.
        </p>
      </hgroup>
      <Suspense fallback={<RoutesSkeleton />}>
        <RoutesContent searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

type RoutesContentProps = Pick<PageProps<"/routes">, "searchParams">;

async function RoutesContent({ searchParams }: RoutesContentProps) {
  const { activity: activityParam, cursor } = await searchParams;
  const activity =
    activityFromSlug(
      typeof activityParam === "string" ? activityParam : undefined,
    ) ?? DEFAULT_ACTIVITY;
  const cursorParam = typeof cursor === "string" ? cursor : undefined;

  const page = await fetchRoutesPage({
    activity,
    cursor: cursorParam,
    limit: ROUTES_PAGE_SIZE,
  });

  return (
    <>
      <ActivityTabs activity={activity} />
      {page.items.length === 0 ? (
        <EmptyState activity={activity} hasCursor={cursorParam !== undefined} />
      ) : (
        <section
          aria-labelledby="activity-routes-heading"
          className="flex flex-col gap-6"
        >
          <h2 id="activity-routes-heading" className="font-serif text-3xl">
            {activityLabel(activity)} routes
          </h2>
          <RouteGrid routes={page.items} />
          <nav
            aria-label="Pagination"
            className="flex flex-row flex-wrap items-center gap-4"
          >
            {cursorParam && (
              <Link
                className="btn btn-ghost rounded-full border-base-300"
                href={routesHref(activity)}
              >
                First page
              </Link>
            )}
            {page.nextCursor ? (
              <Link
                className="btn btn-outline rounded-full"
                href={routesHref(activity, page.nextCursor)}
              >
                Older routes
              </Link>
            ) : (
              <p className="text-base-content/70">
                You&apos;ve reached the end.
              </p>
            )}
          </nav>
        </section>
      )}
    </>
  );
}

function ActivityTabs({ activity }: { activity: string | undefined }) {
  return (
    <nav aria-label="Activity" className="tabs tabs-box self-start">
      {ACTIVITY_FILTERS.map(([value, label]) => (
        <Link
          key={value}
          href={routesHref(value)}
          className={clsx("tab", value === activity && "tab-active")}
          aria-current={value === activity ? "page" : undefined}
        >
          {label}
        </Link>
      ))}
    </nav>
  );
}

function EmptyState({
  activity,
  hasCursor,
}: {
  activity: string;
  hasCursor: boolean;
}) {
  return hasCursor ? (
    <p>
      No more routes here.{" "}
      <Link href={routesHref(activity)} className="link">
        Go to the first page
      </Link>
      .
    </p>
  ) : (
    <p>
      No {activityLabel(activity).toLowerCase()} routes have been shared yet.{" "}
      <Link href="/routes/new" className="link">
        Share the first one
      </Link>
      .
    </p>
  );
}

function routesHref(activity: string, cursor?: string) {
  return {
    pathname: "/routes",
    query: cursor
      ? { activity: activitySlug(activity), cursor }
      : { activity: activitySlug(activity) },
  };
}

function RoutesSkeleton() {
  return (
    <div className="flex flex-col gap-8">
      <div className="skeleton h-10 w-80 max-w-full" aria-hidden="true" />
      <RouteGridSkeleton count={ROUTES_PAGE_SIZE} />
    </div>
  );
}

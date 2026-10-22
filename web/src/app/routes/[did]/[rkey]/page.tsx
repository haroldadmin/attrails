import convert from "convert";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getFormatter, getLocale } from "next-intl/server";
import { type ReactNode, Suspense } from "react";
import { Author } from "@/components/author";
import { ElevationProfile } from "@/components/elevation-profile";
import { RouteMap } from "@/components/route-map";
import { fetchRoute } from "@/data/routes";
import { unitsForLocale } from "@/i18n/units";
import { activityLabel, difficultyLabel, surfaceLabel } from "@/lib/labels";
import { getAuthorProfile } from "@/lib/profiles";

type RoutePageProps = PageProps<"/routes/[did]/[rkey]">;

export async function generateMetadata({
  params,
}: RoutePageProps): Promise<Metadata> {
  const { did, rkey } = await params;
  const route = await fetchRoute(decodeURIComponent(did), rkey);
  if (!route) {
    notFound();
  }

  return { title: `${route.name} · ATTrails` };
}

export default function RoutePage({ params }: RoutePageProps) {
  return (
    <main className="px-4 py-8 sm:p-16">
      <Suspense fallback={<RouteDetailsSkeleton />}>
        <RouteDetails params={params} />
      </Suspense>
    </main>
  );
}

async function RouteDetails({ params }: Pick<RoutePageProps, "params">) {
  const { did, rkey } = await params;
  const route = await fetchRoute(decodeURIComponent(did), rkey);
  if (!route) {
    notFound();
  }

  const [author, format, locale] = await Promise.all([
    getAuthorProfile(route.did),
    getFormatter(),
    getLocale(),
  ]);
  const units = unitsForLocale(locale);

  const surface = route.surface && surfaceLabel(route.surface);
  const difficulty = route.difficulty && difficultyLabel(route.difficulty);

  return (
    <article className="flex flex-col gap-8">
      <header className="flex flex-col gap-4">
        <h1 className="font-serif text-4xl sm:text-5xl">{route.name}</h1>
        <Author profile={author}>
          <time dateTime={route.createdAt.toString()}>
            {format.dateTime(route.createdAt.epochMilliseconds, {
              dateStyle: "long",
            })}
          </time>
        </Author>
      </header>

      <RouteMap
        path={route.path}
        isLoop={route.isLoop}
        className="h-[60vh] min-h-80 rounded-box"
      />

      {route.elevationProfile.length > 0 && (
        <ElevationProfile
          profile={route.elevationProfile}
          locale={locale}
          units={units}
        />
      )}

      <dl className="grid grid-cols-2 sm:grid-cols-4 gap-x-8 gap-y-4">
        <Detail term="Distance">
          {format.number(
            convert(route.distanceM, "meters").to(units.distance),
            "distance",
          )}
        </Detail>
        {route.elevationGainM !== null && (
          <Detail term="Elevation gain">
            {format.number(
              convert(route.elevationGainM, "meters").to(units.elevation),
              "elevation",
            )}
          </Detail>
        )}
        {route.elevationLossM !== null && (
          <Detail term="Elevation loss">
            {format.number(
              convert(route.elevationLossM, "meters").to(units.elevation),
              "elevation",
            )}
          </Detail>
        )}
        <Detail term="Shape">{route.isLoop ? "Loop" : "Point to point"}</Detail>
        <Detail term="Activity">{activityLabel(route.activity)}</Detail>
        {difficulty && <Detail term="Difficulty">{difficulty}</Detail>}
        {surface && <Detail term="Surface">{surface}</Detail>}
      </dl>

      {route.description && (
        <p className="max-w-prose whitespace-pre-line">{route.description}</p>
      )}

      {route.tags.length > 0 && (
        <ul aria-label="Tags" className="flex flex-row flex-wrap gap-2">
          {route.tags.map((tag) => (
            <li key={tag} className="badge badge-soft badge-primary">
              {tag}
            </li>
          ))}
        </ul>
      )}
    </article>
  );
}

function Detail({ term, children }: { term: string; children: ReactNode }) {
  return (
    <div>
      <dt className="text-sm text-base-content/70">{term}</dt>
      <dd className="text-lg font-semibold">{children}</dd>
    </div>
  );
}

function RouteDetailsSkeleton() {
  return (
    <div className="flex flex-col gap-8" aria-hidden="true">
      <div className="flex flex-col gap-4">
        <div className="skeleton h-12 w-2/3" />
        <div className="flex flex-row items-center gap-3">
          <div className="skeleton size-10 rounded-full shrink-0" />
          <div className="skeleton h-4 w-48" />
        </div>
      </div>
      <div className="skeleton h-[60vh] min-h-80" />
      <div className="skeleton h-50" />
      <div className="skeleton h-14 w-full" />
    </div>
  );
}

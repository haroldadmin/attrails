import convert from "convert";
import Link from "next/link";
import { getFormatter, getLocale } from "next-intl/server";
import type { RouteSummary } from "@/data/routes";
import { unitsForLocale } from "@/i18n/units";
import { activityLabel } from "@/lib/labels";
import { fetchAuthorProfile } from "@/lib/profiles";
import { Author } from "./author";
import { RoutePreview } from "./route-preview";

export type RouteCardProps = {
  route: RouteSummary;
};

export async function RouteCard({ route }: RouteCardProps) {
  const now = Temporal.Now.instant();

  const [author, format, locale] = await Promise.all([
    fetchAuthorProfile(route.did),
    getFormatter(),
    getLocale(),
  ]);

  const units = unitsForLocale(locale);

  return (
    <article className="card card-border bg-base-100 h-full relative hover:border-primary">
      <div className="card-body gap-4 p-4">
        <div className="flex flex-row gap-4">
          <RoutePreview
            path={route.path}
            isLoop={route.isLoop}
            className="w-24 sm:w-28 shrink-0 rounded-box"
          />
          <div className="flex flex-col items-start gap-2 min-w-0">
            <h3 className="card-title font-serif text-xl leading-tight">
              <Link
                href={`/routes/${route.did}/${route.rkey}`}
                className="after:absolute after:inset-0"
              >
                {route.name}
              </Link>
            </h3>
            <dl className="flex flex-row flex-wrap gap-x-4 gap-y-1">
              <div>
                <dt className="text-xs text-base-content/70">Distance</dt>
                <dd className="font-semibold">
                  {format.number(
                    convert(route.distanceM, "meters").to(units.distance),
                    "distance",
                  )}
                </dd>
              </div>
              {route.elevationGainM !== null && (
                <div>
                  <dt className="text-xs text-base-content/70">
                    Elevation gain
                  </dt>
                  <dd className="font-semibold">
                    {format.number(
                      convert(route.elevationGainM, "meters").to(
                        units.elevation,
                      ),
                      "elevation",
                    )}
                  </dd>
                </div>
              )}
            </dl>
            <span className="badge badge-soft badge-primary badge-sm">
              {activityLabel(route.activity)}
            </span>
          </div>
        </div>
        <div className="border-t border-base-300 pt-4 mt-auto">
          <Author profile={author}>
            <time dateTime={route.uploadedAt.toString()}>
              {format.relativeTime(
                route.uploadedAt.epochMilliseconds,
                now.epochMilliseconds,
              )}
            </time>
          </Author>
        </div>
      </div>
    </article>
  );
}

export function RouteCardSkeleton() {
  return (
    <div className="card card-border bg-base-100 h-full" aria-hidden="true">
      <div className="card-body gap-4 p-4">
        <div className="flex flex-row gap-4">
          <div className="skeleton w-24 sm:w-28 aspect-square shrink-0" />
          <div className="flex flex-col gap-3 grow">
            <div className="skeleton h-6 w-3/4" />
            <div className="skeleton h-10 w-1/2" />
            <div className="skeleton h-4 w-16" />
          </div>
        </div>
        <div className="flex flex-row items-center gap-3 border-t border-base-300 pt-4">
          <div className="skeleton size-10 rounded-full shrink-0" />
          <div className="skeleton h-4 w-1/2" />
        </div>
      </div>
    </div>
  );
}

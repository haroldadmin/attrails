import convert from "convert";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getFormatter, getLocale } from "next-intl/server";
import { type ReactNode, Suspense } from "react";
import { Author } from "@/components/author";
import { ElevationProfile } from "@/components/elevation-profile";
import { LoginLink } from "@/components/login-link";
import { Notice } from "@/components/notice";
import { RouteMap } from "@/components/route-map";
import { getSession } from "@/auth/session";
import { ShareButton } from "@/components/share-button";
import {
  fetchUserReview,
  fetchReviewSummary,
  fetchReviews,
} from "@/data/reviews";
import { fetchRoute, type Route } from "@/data/routes";
import { unitsForLocale } from "@/i18n/units";
import { activityLabel, difficultyLabel, surfaceLabel } from "@/lib/labels";
import {
  batchFetchAuthorProfiles,
  fetchAuthorProfile,
  unresolvedProfile,
} from "@/lib/profiles";

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
    <main className="flex flex-col gap-8 px-4 py-8 sm:p-16">
      <Suspense>
        <Notice
          messages={{
            "review-posted":
              "Review posted. It'll appear in the reviews once it has been processed.",
            "review-updated":
              "Review updated. Your changes will appear in the reviews once they've been processed.",
            "review-deleted":
              "Review deleted. It'll disappear from the reviews once that has been processed.",
          }}
        />
      </Suspense>
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

  const [author, reviewSummary, format, locale] = await Promise.all([
    fetchAuthorProfile(route.did),
    fetchReviewSummary(route.uri),
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
        <div className="flex flex-row flex-wrap items-center justify-between gap-4">
          <Author profile={author}>
            <time dateTime={route.createdAt.toString()}>
              {format.dateTime(route.createdAt.epochMilliseconds, {
                dateStyle: "long",
              })}
            </time>
          </Author>
          <div className="flex flex-row flex-wrap gap-2">
            <a
              href="#reviews"
              className="btn btn-ghost rounded-full border-base-300"
            >
              {reviewSummary.averageRating !== null && (
                <>
                  <span aria-hidden="true" className="text-warning">
                    ★
                  </span>
                  {format.number(reviewSummary.averageRating, {
                    minimumFractionDigits: 1,
                    maximumFractionDigits: 1,
                  })}
                  <span className="sr-only"> out of 5, </span>
                  <span aria-hidden="true">·</span>
                </>
              )}
              {reviewSummary.count === 0 ? (
                "No reviews yet"
              ) : (
                <>
                  {format.number(reviewSummary.count)}{" "}
                  {reviewSummary.count === 1 ? "review" : "reviews"}
                </>
              )}
            </a>
            <ShareButton
              title={route.name}
              className="btn btn-ghost rounded-full border-base-300"
            />
            <a
              href={`/routes/${route.did}/${route.rkey}/gpx`}
              download
              className="btn btn-neutral rounded-full"
            >
              Download GPX
            </a>
          </div>
        </div>
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

      <Suspense fallback={<RouteReviewsSkeleton />}>
        <RouteReviews route={route} />
      </Suspense>
    </article>
  );
}

const RATINGS = [1, 2, 3, 4, 5];

async function RouteReviews({ route }: { route: Route }) {
  const session = await getSession();
  const viewerDid = session?.did;

  const [reviews, viewerReview, format] = await Promise.all([
    fetchReviews(route.uri, { limit: viewerDid === undefined ? 1 : 10 }),
    viewerDid ? fetchUserReview(route.uri, viewerDid) : null,
    getFormatter(),
  ]);

  const profilesByDid = await batchFetchAuthorProfiles(
    reviews.map((review) => review.did),
  );

  return (
    <section
      id="reviews"
      aria-labelledby="reviews-heading"
      className="flex flex-col gap-6"
    >
      <div className="flex flex-row flex-wrap items-center justify-between gap-4 max-w-prose">
        <h2 id="reviews-heading" className="font-serif text-3xl">
          Reviews
        </h2>
        {viewerDid && viewerDid !== route.did && !viewerReview && (
          <Link
            href={`/routes/${route.did}/${route.rkey}/review`}
            className="btn btn-neutral rounded-full"
          >
            Write a review
          </Link>
        )}
      </div>

      {!viewerDid && (
        <p>
          <LoginLink className="link">Log in</LoginLink> to review this route
          and to read all reviews.
        </p>
      )}

      {reviews.length === 0 ? (
        <p className="text-base-content/70">No reviews yet.</p>
      ) : (
        <ol className="flex flex-col gap-6 max-w-prose">
          {reviews.map((review) => (
            <li key={`${review.did}/${review.rkey}`}>
              <article className="flex flex-col gap-2">
                <div className="flex flex-row items-center justify-between gap-4">
                  <Author
                    profile={
                      profilesByDid.get(review.did) ??
                      unresolvedProfile(review.did)
                    }
                  >
                    <time dateTime={review.createdAt.toString()}>
                      {format.dateTime(review.createdAt.epochMilliseconds, {
                        dateStyle: "long",
                      })}
                    </time>
                  </Author>
                  {review.did === viewerDid && (
                    <Link
                      href={`/routes/${route.did}/${route.rkey}/review`}
                      className="btn btn-ghost btn-sm rounded-full border-base-300"
                    >
                      Edit<span className="sr-only"> your review</span>
                    </Link>
                  )}
                </div>
                <div
                  role="img"
                  aria-label={`Rated ${review.rating} out of 5`}
                  className="rating rating-sm"
                >
                  {RATINGS.map((rating) => (
                    <div
                      key={rating}
                      className="mask mask-star-2 bg-warning"
                      aria-current={rating === review.rating}
                    />
                  ))}
                </div>
                {review.text && (
                  <p className="whitespace-pre-line">{review.text}</p>
                )}
              </article>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

function RouteReviewsSkeleton() {
  return (
    <div className="flex flex-col gap-6" aria-hidden="true">
      <div className="skeleton h-9 w-40" />
      <div className="skeleton h-64 w-full max-w-prose" />
    </div>
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
        <div className="flex flex-row flex-wrap items-center justify-between gap-4">
          <div className="flex flex-row items-center gap-3">
            <div className="skeleton size-10 rounded-full shrink-0" />
            <div className="skeleton h-4 w-48" />
          </div>
          <div className="skeleton h-10 w-80 rounded-full" />
        </div>
      </div>
      <div className="skeleton h-[60vh] min-h-80" />
      <div className="skeleton h-50" />
      <div className="skeleton h-14 w-full" />
    </div>
  );
}

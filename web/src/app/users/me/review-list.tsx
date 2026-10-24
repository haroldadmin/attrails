"use client";

import Link from "next/link";
import { LoadOnScroll } from "@/components/load-on-scroll";
import { ReviewModerationNotice } from "@/components/moderation-notice";
import { ReviewRating } from "@/components/review-rating";
import { usePages } from "@/hooks/use-pages";
import type { Page } from "@/lib/pages";
import { loadReviews } from "./actions";
import type { ReviewListItem } from "../listings";

export type ReviewListProps = {
  firstPage: Page<ReviewListItem>;
};

export function ReviewList({ firstPage }: ReviewListProps) {
  const reviews = usePages(firstPage, loadReviews);

  return (
    <>
      <ol className="flex flex-col gap-8 max-w-prose">
        {reviews.items.map((review) => {
          const routePath = `/routes/${review.route.did}/${review.route.rkey}`;

          return (
            <li key={review.rkey}>
              <article className="flex flex-col gap-2">
                <div className="flex flex-row items-center justify-between gap-4">
                  <div className="flex flex-col min-w-0">
                    <h3 className="font-serif text-xl truncate">
                      <Link href={routePath} className="link-hover">
                        {review.route.name}
                      </Link>
                    </h3>
                    <time
                      dateTime={review.createdAt}
                      className="text-sm text-base-content/70"
                    >
                      {review.createdOn}
                    </time>
                  </div>
                  <Link
                    href={`${routePath}/review`}
                    className="btn btn-ghost btn-sm rounded-full border-base-300"
                  >
                    Edit
                    <span className="sr-only">
                      {" "}
                      your review of {review.route.name}
                    </span>
                  </Link>
                </div>
                {review.labelled && <ReviewModerationNotice />}
                <ReviewRating rating={review.rating} />
                {review.text && (
                  <p className="whitespace-pre-line">{review.text}</p>
                )}
              </article>
            </li>
          );
        })}
      </ol>
      {reviews.hasMore && (
        <LoadOnScroll
          onLoad={reviews.loadMore}
          loading={reviews.loading}
          loadingLabel="Loading more reviews…"
        />
      )}
      {reviews.failed && (
        <p role="alert" className="text-error">
          We couldn&apos;t load more reviews. Reload the page to try again.
        </p>
      )}
    </>
  );
}

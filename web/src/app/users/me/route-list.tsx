"use client";

import Link from "next/link";
import { LoadOnScroll } from "@/components/load-on-scroll";
import { useGenerator } from "@/hooks/use-generator";
import { type Page, pagesAfter } from "@/lib/pages";
import { loadRoutes } from "./actions";
import type { RouteListItem } from "./listings";

export type RouteListProps = {
  firstPage: Page<RouteListItem>;
};

export function RouteList({ firstPage }: RouteListProps) {
  const routes = useGenerator(
    () => pagesAfter(firstPage.nextCursor, loadRoutes),
    firstPage.items,
  );

  return (
    <>
      <ul className="flex flex-col divide-y divide-base-300 max-w-prose">
        {routes.items.map((route) => (
          <li
            key={route.rkey}
            className="flex flex-row flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-3"
          >
            <Link
              href={`/routes/${route.did}/${route.rkey}`}
              className="font-semibold link-hover"
            >
              {route.name}
            </Link>
            <span className="text-sm text-base-content/70">
              {route.activity} ·{" "}
              <time dateTime={route.uploadedAt}>{route.uploadedOn}</time>
            </span>
          </li>
        ))}
      </ul>
      {routes.hasMore && (
        <LoadOnScroll
          onLoad={routes.generate}
          loading={routes.loading}
          loadingLabel="Loading more routes…"
        />
      )}
      {routes.failed && (
        <p role="alert" className="text-error">
          We couldn&apos;t load more routes. Reload the page to try again.
        </p>
      )}
    </>
  );
}

import Link from "next/link";
import { Suspense } from "react";
import { AtTrailsLogo } from "./logo";
import { RouteSearch } from "./route-search";
import { SessionState } from "./session-state";

export function TopNav() {
  return (
    <div className="flex flex-row flex-wrap items-center gap-x-6 gap-y-3 py-3 border-b border-base-300">
      <AtTrailsLogo size="large" />
      <nav aria-label="Activities" className="hidden lg:block lg:ml-2">
        <ul className="flex flex-row items-center gap-6">
          <li>
            <Link className="link-hover" href="/routes?activity=running">
              Running
            </Link>
          </li>
          <li>
            <Link className="link-hover" href="/routes?activity=cycling">
              Cycling
            </Link>
          </li>
          <li>
            <Link className="link-hover" href="/routes?activity=hiking">
              Hiking
            </Link>
          </li>
        </ul>
      </nav>
      <RouteSearch className="order-last w-full lg:order-none lg:ml-auto lg:w-56 xl:w-72" />
      <div className="flex flex-1 flex-row items-center justify-end gap-x-4 min-w-0 lg:flex-none lg:gap-x-6">
        <Suspense>
          <SessionState />
        </Suspense>
        <Link className="btn btn-primary btn-sm shrink-0" href="/routes/new">
          <span className="lg:hidden">Share</span>
          <span className="hidden lg:inline">Share a route</span>
        </Link>
      </div>
    </div>
  );
}

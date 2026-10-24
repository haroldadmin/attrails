import Link from "next/link";
import { Suspense } from "react";
import { RouteSearch } from "./route-search";
import { SessionState } from "./session-state";

export function TopNav() {
  return (
    <nav className="flex flex-row flex-wrap items-center gap-x-6 gap-y-3 grow">
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
      <RouteSearch className="order-last w-full lg:order-none lg:ml-auto lg:w-56 xl:w-72" />
      <div className="flex flex-row flex-wrap items-center gap-x-6 gap-y-3 ml-auto lg:ml-0">
        <Suspense>
          <SessionState />
        </Suspense>
        <Link className="btn btn-primary btn-sm" href="/routes/new">
          Share a route
        </Link>
      </div>
    </nav>
  );
}

import Link from "next/link";
import { Suspense } from "react";
import { SessionState } from "./session-state";

export function TopNav() {
  return (
    <nav className="flex flex-row flex-wrap items-center gap-x-6 gap-y-3 grow">
      <ul className="flex flex-row items-center gap-6">
        <li>
          <Link className="link-hover" href="/">
            Discover
          </Link>
        </li>
        <li>
          <Link className="link-hover" href="/about">
            About
          </Link>
        </li>
      </ul>
      <div className="flex flex-row flex-wrap items-center gap-x-6 gap-y-3 ml-auto">
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

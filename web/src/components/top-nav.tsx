import Link from "next/link";
import { Suspense } from "react";
import { SessionState } from "./session-state";

export function TopNav() {
  return (
    <nav className="navbar">
      <div className="flex flex-row justify-between w-full gap-4">
        <ul className="flex flex-row gap-4">
          <li>
            <Link className="link-hover" href="/">
              Discover
            </Link>
          </li>
        </ul>
        <div>
          <Suspense>
            <SessionState />
          </Suspense>
        </div>
      </div>
    </nav>
  );
}

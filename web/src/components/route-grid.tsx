import type { RouteSummary } from "@/lib/routes";
import { RouteCard, RouteCardSkeleton } from "./route-card";

export function RouteGrid({ routes }: { routes: RouteSummary[] }) {
  return (
    <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {routes.map((route) => (
        <li key={`${route.did}/${route.rkey}`}>
          <RouteCard route={route} />
        </li>
      ))}
    </ul>
  );
}

export function RouteGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3" aria-hidden="true">
      {Array.from({ length: count }, (_, i) => (
        <li key={i}>
          <RouteCardSkeleton />
        </li>
      ))}
    </ul>
  );
}

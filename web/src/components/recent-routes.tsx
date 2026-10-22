import { fetchRecentRoutes } from "@/data/routes";
import { RouteCard, RouteCardSkeleton } from "./route-card";

// Divisible by both grid layouts (2 and 3 columns).
const RECENT_ROUTES_LIMIT = 12;

export async function RecentRoutes() {
  const routes = await fetchRecentRoutes(RECENT_ROUTES_LIMIT);
  if (routes.length === 0) {
    return <p>No routes yet.</p>;
  }

  const now = Temporal.Now.instant();

  return (
    <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {routes.map((route) => (
        <li key={`${route.did}/${route.rkey}`}>
          <RouteCard route={route} now={now} />
        </li>
      ))}
    </ul>
  );
}

export function RecentRoutesSkeleton() {
  return (
    <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 6 }, (_, i) => (
        <li key={i}>
          <RouteCardSkeleton />
        </li>
      ))}
    </ul>
  );
}

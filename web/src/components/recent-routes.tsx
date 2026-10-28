import Link from "next/link";
import { loadRoutes } from "@/lib/routes";
import { RouteCard, RouteCardSkeleton } from "./route-card";

// With the invitation card, fills both grid layouts (2 and 3 columns).
const RECENT_ROUTES_LIMIT = 11;

export async function RecentRoutes() {
  const { items: routes } = await loadRoutes({
    labelled: "exclude",
    limit: RECENT_ROUTES_LIMIT,
  });
  return (
    <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {routes.map((route) => (
        <li key={`${route.did}/${route.rkey}`}>
          <RouteCard route={route} />
        </li>
      ))}
      <li>
        <ShareRouteCard />
      </li>
    </ul>
  );
}

function ShareRouteCard() {
  return (
    <aside
      aria-labelledby="share-route-heading"
      className="card card-dash border-base-300 h-full"
    >
      <div className="card-body items-start justify-center gap-3 p-4">
        <h3 id="share-route-heading" className="card-title font-serif text-xl">
          Share yours
        </h3>
        <p>
          ATTrails is just getting started. Know a route worth riding, running,
          or hiking? Share it and help others find it.
        </p>
        <Link className="btn btn-primary btn-sm" href="/routes/new">
          Share a route
        </Link>
      </div>
    </aside>
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

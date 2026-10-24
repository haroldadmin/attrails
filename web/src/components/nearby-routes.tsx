import { approximateLocation } from "@/lib/location";
import { fetchRoutesNear } from "@/lib/routes";
import { RouteCard } from "./route-card";

// Fills both grid layouts (2 and 3 columns).
const NEARBY_ROUTES_LIMIT = 6;

// IP geolocation is only accurate to about a city, so look a little further.
const NEARBY_RADIUS_M = 50_000;

/**
 * Lists routes starting near the visitor's approximate location. Renders
 * nothing if the location is unknown or no routes are nearby.
 */
export async function NearbyRoutes() {
  const location = await approximateLocation();
  if (!location) {
    return null;
  }

  const routes = await fetchRoutesNear(location, {
    radiusM: NEARBY_RADIUS_M,
    limit: NEARBY_ROUTES_LIMIT,
  });
  if (routes.length === 0) {
    return null;
  }

  return (
    <section
      aria-labelledby="nearby-routes-heading"
      className="flex flex-col gap-6"
    >
      <hgroup className="flex flex-col gap-2">
        <h2 id="nearby-routes-heading" className="font-serif text-3xl">
          Near you
        </h2>
        <p className="text-base-content/70">
          Based on your approximate location.
        </p>
      </hgroup>
      <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {routes.map((route) => (
          <li key={`${route.did}/${route.rkey}`}>
            <RouteCard route={route} />
          </li>
        ))}
      </ul>
    </section>
  );
}

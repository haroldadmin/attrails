import "server-only";

// Everything the app reads, validates, and writes about routes. Client
// components import `@/lib/routes/shared` instead.

export * from "./shared";
export * from "./vocabulary";
export {
  fetchRouteGpx,
  loadRoute,
  loadRouteNames,
  loadRoutes,
  loadRoutesMatching,
  loadRoutesNear,
  loadRouteSummary,
  type RouteGpxError,
  type RouteGpxResult,
} from "./queries";
export {
  createRoute,
  type CreateRouteError,
  type CreateRouteResult,
  deleteRoute,
  type DeleteRouteError,
  type DeleteRouteResult,
  saveRoute,
  type SaveRouteError,
  type SaveRouteResult,
} from "./records";

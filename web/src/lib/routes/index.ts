import "server-only";

// Everything the app reads, validates, and writes about routes. Client
// components import `@/lib/routes/shared` instead.

export * from "./shared";
export * from "./vocabulary";
export {
  fetchRouteGpx,
  fetchRouteImage,
  loadRoute,
  loadRouteNames,
  loadRoutes,
  loadRoutesMatching,
  loadRoutesNear,
  loadRouteSummary,
  type RouteGpxError,
  type RouteGpxResult,
  type RouteImageError,
  type RouteImageResult,
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
  uploadRouteImage,
  type UploadRouteImageError,
  type UploadRouteImageResult,
} from "./records";

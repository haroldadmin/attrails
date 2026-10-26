import type { Instrumentation } from "next";

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./instrumentation.node");
  }
}

export const onRequestError: Instrumentation.onRequestError = async (
  error,
  request,
  context,
) => {
  const { logger } = await import("@/lib/logger");
  logger.error(
    {
      err: error,
      method: request.method,
      path: request.path,
      route: context.routePath,
      routeType: context.routeType,
    },
    "request:error",
  );
};

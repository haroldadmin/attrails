"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

/**
 * Confirms a route upload. New routes only show up once the ingester has
 * processed them, so this explains why the route isn't listed yet.
 */
export function UploadedNotice() {
  const router = useRouter();
  const pathname = usePathname();
  if (useSearchParams().get("uploaded") !== "1") {
    return null;
  }

  return (
    <div role="status" className="alert alert-success alert-soft">
      <span>
        Route uploaded. It&apos;ll appear here once it has been processed.
      </span>
      <button
        type="button"
        className="btn btn-sm btn-ghost"
        onClick={() => router.replace(pathname, { scroll: false })}
      >
        Dismiss
      </button>
    </div>
  );
}

"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

export type NoticeProps = {
  // Messages keyed by the `notice` search parameter that shows them.
  messages: Record<string, string>;
};

/**
 * Confirms an action that redirected here with `?notice=…`. Records only show
 * up once the ingester has processed them, so the messages explain the wait.
 */
export function Notice({ messages }: NoticeProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const notice = searchParams.get("notice");
  const message = notice ? messages[notice] : undefined;
  if (!notice || !message) {
    return null;
  }

  function dismiss() {
    const params = new URLSearchParams(searchParams);
    params.delete("notice");
    const query = params.size > 0 ? `?${params}` : "";
    router.replace(pathname + query, { scroll: false });
  }

  return (
    <div role="status" className="alert alert-success alert-soft">
      <span>{message}</span>
      <button type="button" className="btn btn-sm btn-ghost" onClick={dismiss}>
        Dismiss
      </button>
    </div>
  );
}

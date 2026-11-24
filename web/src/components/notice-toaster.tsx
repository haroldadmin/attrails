"use client";

import { CircleCheck } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { type CSSProperties, Suspense, useEffect } from "react";
import { toast, Toaster } from "sonner";
import { isNotice, NOTICE_PARAM, NOTICES } from "./notices";

const NOTICE_DURATION_MS = 10_000;

const themeStyle = {
  fontFamily: "var(--font-sans)",
  "--normal-bg": "var(--color-base-100)",
  "--normal-border": "var(--color-base-300)",
  "--normal-text": "var(--color-base-content)",
  "--border-radius": "var(--radius-box)",
} as CSSProperties;

export function NoticeToaster() {
  return (
    <>
      <Toaster
        closeButton
        duration={NOTICE_DURATION_MS}
        icons={{ success: <CircleCheck className="size-4 text-success" /> }}
        style={themeStyle}
      />
      <Suspense>
        <SearchParamNotice />
      </Suspense>
    </>
  );
}

function SearchParamNotice() {
  const notice = useSearchParams().get(NOTICE_PARAM);

  useEffect(() => {
    if (notice === null) {
      return;
    }

    if (isNotice(notice)) {
      toast.success(NOTICES[notice], { id: notice });
    }

    // Unlike `router.replace`, this doesn't re-render the page on the server.
    const url = new URL(window.location.href);
    url.searchParams.delete(NOTICE_PARAM);
    window.history.replaceState(null, "", url);
  }, [notice]);

  return null;
}

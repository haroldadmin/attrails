"use client";

import { useState } from "react";

export type ShareButtonProps = {
  title: string;
  className?: string;
};

export function ShareButton({ title, className }: ShareButtonProps) {
  const [copied, setCopied] = useState(false);

  async function share() {
    const url = window.location.href;
    if (!navigator.share) {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      return;
    }

    try {
      await navigator.share({ title, url });
    } catch (error) {
      // Closing the share sheet rejects with an AbortError.
      if (!(error instanceof DOMException && error.name === "AbortError")) {
        throw error;
      }
    }
  }

  return (
    <button
      type="button"
      className={className}
      onClick={share}
      onBlur={() => setCopied(false)}
    >
      <span aria-live="polite">{copied ? "Link copied" : "Share"}</span>
    </button>
  );
}

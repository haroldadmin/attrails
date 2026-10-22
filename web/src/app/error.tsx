"use client";

import { useEffect } from "react";

export default function Error({
  error,
  retry,
}: {
  error: unknown;
  retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="flex flex-col gap-6 px-4 py-8 sm:p-16">
      <h1 className="font-serif text-4xl">Something went wrong</h1>
      <p>
        <button className="btn btn-primary" onClick={() => retry()}>
          Try again
        </button>
      </p>
    </main>
  );
}

"use client";

import clsx from "clsx";
import Link from "next/link";
import { type ReactNode, useEffect, useRef, useState } from "react";
import {
  MAX_QUERY_LENGTH,
  MIN_QUERY_LENGTH,
  type RouteSearchItem,
} from "@/lib/route-search";

const DEBOUNCE_MS = 250;

type Results =
  | { status: "pending" }
  | { status: "done"; query: string; items: RouteSearchItem[] }
  | { status: "failed" };

/**
 * Searches routes by name as the reader types, listing matches as links to
 * their pages.
 */
export function RouteSearch({ className }: { className?: string }) {
  const rootRef = useRef<HTMLElement>(null);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [results, setResults] = useState<Results>({ status: "pending" });

  const trimmed = query.trim();
  const searchable = trimmed.length >= MIN_QUERY_LENGTH;

  useEffect(() => {
    if (!searchable) {
      return;
    }

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const response = await fetch(
          `/routes/search?${new URLSearchParams({ q: trimmed })}`,
          { signal: controller.signal },
        );
        if (!response.ok) {
          throw new Error(`Search failed with status ${response.status}`);
        }
        const { items } = await response.json();
        setResults({ status: "done", query: trimmed, items });
      } catch {
        if (!controller.signal.aborted) {
          setResults({ status: "failed" });
        }
      }
    }, DEBOUNCE_MS);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [trimmed, searchable]);

  // Clicking a link doesn't focus it in every browser, so watch for presses
  // outside rather than relying on focus alone.
  useEffect(() => {
    if (!open) {
      return;
    }

    const closeOnOutsidePress = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    document.addEventListener("pointerdown", closeOnOutsidePress);
    return () =>
      document.removeEventListener("pointerdown", closeOnOutsidePress);
  }, [open]);

  const expanded = open && searchable;

  return (
    <search
      ref={rootRef}
      className={clsx("relative", className)}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          setOpen(false);
        }
      }}
      onBlur={(event) => {
        const next = event.relatedTarget;
        if (next && !event.currentTarget.contains(next)) {
          setOpen(false);
        }
      }}
    >
      <label className="input w-full h-10 lg:h-8 gap-2 px-3 bg-base-200/50 border-base-300 shadow-none focus-within:bg-base-100 focus-within:border-primary focus-within:outline-primary/25 focus-within:outline-offset-0">
        <SearchIcon />
        <span className="sr-only">Search routes</span>
        <input
          type="search"
          className="grow text-base lg:text-sm placeholder:text-base-content/60 [&::-webkit-search-cancel-button]:appearance-none"
          placeholder="Search routes"
          autoComplete="off"
          spellCheck={false}
          maxLength={MAX_QUERY_LENGTH}
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setOpen(true);
            if (event.target.value.trim().length < MIN_QUERY_LENGTH) {
              setResults({ status: "pending" });
            }
          }}
          onFocus={() => setOpen(true)}
        />
      </label>
      <p role="status" className="sr-only">
        {expanded && statusText(results)}
      </p>
      {expanded && (
        <div className="absolute inset-x-0 top-full z-20 mt-2 lg:left-auto lg:w-96 rounded-box border border-base-300 bg-base-100 p-1.5 shadow-xl shadow-base-content/10">
          <SearchResults
            results={results}
            onSelect={() => {
              setQuery("");
              setOpen(false);
              setResults({ status: "pending" });
            }}
          />
        </div>
      )}
    </search>
  );
}

function SearchIcon() {
  return (
    <svg
      className="size-4 shrink-0 text-base-content/60"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </svg>
  );
}

function SearchResults({
  results,
  onSelect,
}: {
  results: Results;
  onSelect: () => void;
}) {
  switch (results.status) {
    case "pending":
      return <Message>Searching…</Message>;
    case "failed":
      return (
        <Message className="text-error">
          Search isn&apos;t working right now.
        </Message>
      );
    case "done":
      if (results.items.length === 0) {
        return (
          <Message>No routes match &ldquo;{results.query}&rdquo;.</Message>
        );
      }

      return (
        <ul className="flex flex-col">
          {results.items.map((route) => (
            <li key={`${route.did}/${route.rkey}`}>
              <Link
                href={`/routes/${route.did}/${route.rkey}`}
                className="group flex flex-col gap-0.5 rounded-field px-3 py-2 hover:bg-base-200/60 focus-visible:bg-base-200/60 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary"
                onClick={onSelect}
              >
                <span className="font-serif text-lg leading-snug truncate group-hover:text-primary group-focus-visible:text-primary">
                  {route.name}
                </span>
                <span className="text-sm text-base-content/60 tabular-nums">
                  {route.activity}
                  <span aria-hidden="true"> · </span>
                  <span className="sr-only">, </span>
                  {route.distance}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      );
  }
}

function Message({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <p className={clsx("px-3 py-2 text-sm text-base-content/60", className)}>
      {children}
    </p>
  );
}

function statusText(results: Results): string {
  switch (results.status) {
    case "pending":
      return "";
    case "failed":
      return "Search isn't working right now.";
    case "done":
      if (results.items.length === 0) {
        return `No routes match “${results.query}”.`;
      }
      return results.items.length === 1
        ? "1 route found."
        : `${results.items.length} routes found.`;
  }
}

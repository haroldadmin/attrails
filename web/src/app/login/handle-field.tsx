"use client";

import { useEffect, useRef, useState } from "react";
import { Avatar } from "@/components/author";
import {
  ACTOR_QUERY_MAX_LENGTH,
  ACTOR_QUERY_MIN_LENGTH,
  type ActorSuggestion,
} from "@/lib/profiles/shared";

const DEBOUNCE_MS = 200;
const LIST_ID = "handle-suggestions";
// How far a finger may move (px) and still count as a tap rather than a scroll.
const TAP_SLOP = 10;

/**
 * Handle input that suggests matching Bluesky accounts as the reader types.
 */
export function HandleField({ defaultValue }: { defaultValue: string }) {
  const [handle, setHandle] = useState(defaultValue);
  const [open, setOpen] = useState(false);
  const [suggestions, setSuggestions] = useState<ActorSuggestion[]>([]);
  const [active, setActive] = useState(-1);
  const touchStart = useRef<{ x: number; y: number } | null>(null);

  const query = handle.trim().replace(/^@/, "");
  const searchable = open && query.length >= ACTOR_QUERY_MIN_LENGTH;

  useEffect(() => {
    if (!searchable) {
      return;
    }

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const response = await fetch(
          `/login/actors?${new URLSearchParams({ q: query })}`,
          { signal: controller.signal },
        );
        const { items } = response.ok ? await response.json() : { items: [] };
        setSuggestions(items);
        setActive(-1);
      } catch {
        if (!controller.signal.aborted) {
          setSuggestions([]);
        }
      }
    }, DEBOUNCE_MS);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query, searchable]);

  const expanded = searchable && suggestions.length > 0;

  const choose = (item: ActorSuggestion) => {
    setHandle(item.handle);
    setOpen(false);
  };

  return (
    <div className="relative">
      <input
        id="handle"
        name="handle"
        type="text"
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={expanded}
        aria-controls={LIST_ID}
        aria-activedescendant={
          expanded && active >= 0 ? `${LIST_ID}-${active}` : undefined
        }
        className="input w-full"
        placeholder="alice.bsky.social"
        autoComplete="username"
        autoCapitalize="none"
        spellCheck={false}
        maxLength={ACTOR_QUERY_MAX_LENGTH}
        value={handle}
        onChange={(event) => {
          setHandle(event.target.value);
          setOpen(true);
          setActive(-1);
        }}
        onBlur={() => setOpen(false)}
        onKeyDown={(event) => {
          if (!expanded) {
            return;
          }

          switch (event.key) {
            case "ArrowDown":
              event.preventDefault();
              setActive((index) => (index + 1) % suggestions.length);
              break;
            case "ArrowUp":
              event.preventDefault();
              setActive(
                (index) => (index <= 0 ? suggestions.length : index) - 1,
              );
              break;
            case "Enter":
              if (active >= 0) {
                event.preventDefault();
                choose(suggestions[active]);
              }
              break;
            case "Escape":
              event.preventDefault();
              setOpen(false);
              break;
          }
        }}
        required
      />
      <ul
        id={LIST_ID}
        role="listbox"
        aria-label="Suggested accounts"
        hidden={!expanded}
        className="absolute inset-x-0 top-full z-20 mt-2 rounded-box border border-base-300 bg-base-100 p-1.5 shadow-xl shadow-base-content/10"
      >
        {suggestions.map((item, index) => (
          <li
            key={item.did}
            id={`${LIST_ID}-${index}`}
            role="option"
            aria-selected={index === active}
            className="flex items-center gap-3 rounded-field px-3 py-2 cursor-pointer hover:bg-base-200/60 aria-selected:bg-base-200/60"
            onPointerDown={(event) => event.preventDefault()}
            onTouchStart={(event) => {
              const touch = event.touches[0];
              touchStart.current = { x: touch.clientX, y: touch.clientY };
            }}
            onTouchEnd={(event) => {
              // Mobile browsers blur the input on tap even when pointerdown is
              // cancelled, hiding the list before the click lands. Choose on
              // touchend instead and cancel the blur and the follow-up click.
              const start = touchStart.current;
              const touch = event.changedTouches[0];
              touchStart.current = null;
              if (
                !start ||
                Math.hypot(touch.clientX - start.x, touch.clientY - start.y) >
                  TAP_SLOP
              ) {
                return;
              }
              event.preventDefault();
              choose(item);
            }}
            onClick={() => choose(item)}
          >
            <Avatar profile={item} />
            <span className="flex flex-col min-w-0 text-sm leading-snug">
              <span className="font-semibold truncate">
                {item.displayName ?? item.handle}
              </span>
              {item.displayName && (
                <span className="text-base-content/70 truncate">
                  @{item.handle}
                </span>
              )}
            </span>
          </li>
        ))}
      </ul>
      <p role="status" className="sr-only">
        {expanded &&
          (suggestions.length === 1
            ? "1 account suggested."
            : `${suggestions.length} accounts suggested.`)}
      </p>
    </div>
  );
}

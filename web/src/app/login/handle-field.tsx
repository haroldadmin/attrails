"use client";

import { useEffect, useState } from "react";
import { Avatar } from "@/components/author";
import {
  type ActorSearchItem,
  MAX_QUERY_LENGTH,
  MIN_QUERY_LENGTH,
} from "@/lib/actor-search";

const DEBOUNCE_MS = 200;
const LIST_ID = "handle-suggestions";

/**
 * Handle input that suggests matching Bluesky accounts as the reader types.
 */
export function HandleField({ defaultValue }: { defaultValue: string }) {
  const [handle, setHandle] = useState(defaultValue);
  const [open, setOpen] = useState(false);
  const [suggestions, setSuggestions] = useState<ActorSearchItem[]>([]);
  const [active, setActive] = useState(-1);

  const query = handle.trim().replace(/^@/, "");
  const searchable = open && query.length >= MIN_QUERY_LENGTH;

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

  const choose = (item: ActorSearchItem) => {
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
        maxLength={MAX_QUERY_LENGTH}
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

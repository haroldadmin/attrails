"use client";

import { type KeyboardEvent, useRef, useState } from "react";
import { MAX_TAGS, parseTags } from "@/lib/route-form";

const FULL_MESSAGE = "That's the most tags a route can have.";

export type TagInputProps = {
  id: string;
  name: string;
  /** Comma-separated tags. */
  defaultValue: string;
  placeholder?: string;
  "aria-describedby"?: string;
};

/**
 * A text input that turns comma-separated words into removable badges.
 *
 * Submits the badges as one comma-separated value under `name`, and the word
 * being typed as a second value under the same `name`, so it isn't lost when
 * the form is submitted before the word becomes a badge or before hydration.
 */
export function TagInput({
  id,
  name,
  defaultValue,
  placeholder,
  "aria-describedby": describedBy,
}: TagInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [tags, setTags] = useState(() => parseTags(defaultValue));
  const [draft, setDraft] = useState("");
  const [announcement, setAnnouncement] = useState("");
  const full = tags.length >= MAX_TAGS;

  function add(text: string) {
    const next = parseTags([...tags, text].join(","));
    const added = next.slice(tags.length);
    setTags(next);
    if (added.length > 0) {
      const message = `Added ${added.join(", ")}.`;
      setAnnouncement(
        next.length >= MAX_TAGS ? `${message} ${FULL_MESSAGE}` : message,
      );
    }
  }

  function remove(tag: string) {
    setTags(tags.filter((other) => other !== tag));
    setAnnouncement(`Removed ${tag}.`);
    inputRef.current?.focus();
  }

  function handleChange(value: string) {
    // Typing or pasting a comma adds everything before the last one.
    const lastComma = value.lastIndexOf(",");
    if (lastComma !== -1) {
      add(value.slice(0, lastComma));
    }
    setDraft(value.slice(lastComma + 1).trimStart());
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.nativeEvent.isComposing) {
      return;
    }
    if (event.key === "Enter" && draft) {
      event.preventDefault();
      add(draft);
      setDraft("");
    } else if (event.key === "Backspace" && !draft && tags.length > 0) {
      remove(tags[tags.length - 1]);
    }
  }

  return (
    <>
      <div className="input w-full h-auto min-h-10 flex-wrap gap-1.5 py-1.5">
        {tags.length > 0 && (
          <ul aria-label="Tags" className="flex flex-wrap gap-1.5">
            {tags.map((tag) => (
              <li key={tag} className="badge badge-soft badge-primary gap-1">
                {tag}
                <button
                  type="button"
                  className="cursor-pointer opacity-70 hover:opacity-100"
                  aria-label={`Remove ${tag}`}
                  onClick={() => remove(tag)}
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        )}
        <input
          ref={inputRef}
          id={id}
          name={name}
          type="text"
          className="min-w-32 flex-1"
          placeholder={
            full ? FULL_MESSAGE : tags.length === 0 ? placeholder : undefined
          }
          value={draft}
          readOnly={full}
          aria-describedby={describedBy}
          onChange={(event) => handleChange(event.currentTarget.value)}
          onKeyDown={handleKeyDown}
          onBlur={() => {
            add(draft);
            setDraft("");
          }}
        />
      </div>
      <input type="hidden" name={name} value={tags.join(", ")} />
      <p className="sr-only" aria-live="polite">
        {announcement}
      </p>
    </>
  );
}

"use client";

import { type MouseEvent, useEffect, useRef, useState } from "react";
import { ROUTE_IMAGE_ALT_MAX_GRAPHEMES } from "@/lib/routes/shared";
import type { Photo } from "./use-photo-uploads";

export type PhotoAltDialogProps = {
  photo: Photo | null;
  number: number;
  onSave: (alt: string) => void;
  onClose: () => void;
};

/**
 * A modal for editing a photo's alt text. It's open while there's a `photo`.
 * It renders inside the route form, so it has no form of its own.
 */
export function PhotoAltDialog({
  photo,
  number,
  onSave,
  onClose,
}: PhotoAltDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const open = photo !== null;

  useEffect(() => {
    const dialog = dialogRef.current;
    if (open && !dialog?.open) {
      dialog?.showModal();
    } else if (!open && dialog?.open) {
      dialog.close();
    }
  }, [open]);

  function handleClick(event: MouseEvent<HTMLDialogElement>) {
    if (event.target === event.currentTarget) {
      onClose();
    }
  }

  return (
    <dialog
      ref={dialogRef}
      className="modal"
      aria-labelledby="photo-alt-heading"
      onClose={onClose}
      onClick={handleClick}
    >
      {photo && (
        <AltTextEditor
          key={photo.id}
          photo={photo}
          number={number}
          onSave={onSave}
          onCancel={onClose}
        />
      )}
    </dialog>
  );
}

function AltTextEditor({
  photo,
  number,
  onSave,
  onCancel,
}: {
  photo: Photo;
  number: number;
  onSave: (alt: string) => void;
  onCancel: () => void;
}) {
  const [draft, setDraft] = useState(photo.alt);

  return (
    <div className="modal-box flex flex-col gap-4">
      <h2 id="photo-alt-heading" className="text-lg font-semibold">
        Alt text for photo {number}
      </h2>
      {/* eslint-disable-next-line @next/next/no-img-element -- next/image can't optimise new photos' local `blob:` URLs. */}
      <img
        src={photo.previewUrl}
        alt=""
        className="max-h-[55vh] w-full rounded-box bg-base-200 object-contain"
      />
      <div className="flex flex-col gap-1">
        <label className="font-semibold" htmlFor="photo-alt">
          Alt text
        </label>
        <textarea
          id="photo-alt"
          className="textarea w-full"
          rows={3}
          maxLength={ROUTE_IMAGE_ALT_MAX_GRAPHEMES}
          value={draft}
          aria-describedby="photo-alt-hint"
          onChange={(event) => setDraft(event.currentTarget.value)}
        />
        <p id="photo-alt-hint" className="text-sm text-base-content/70">
          Describe the photo for people who can&apos;t see it.
        </p>
      </div>
      <div className="modal-action mt-0">
        <button type="button" className="btn btn-ghost" onClick={onCancel}>
          Cancel
        </button>
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => onSave(draft)}
        >
          Save
        </button>
      </div>
    </div>
  );
}

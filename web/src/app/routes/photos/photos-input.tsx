"use client";

import clsx from "clsx";
import { ImagePlus, Plus } from "lucide-react";
import { type ChangeEvent, useEffect, useRef, useState } from "react";
import {
  ROUTE_IMAGE_TYPES,
  ROUTE_MAX_IMAGES,
  type RouteImage,
} from "@/lib/routes/shared";
import { PhotoAltDialog } from "./photo-alt-dialog";
import { PhotoTile } from "./photo-tile";
import { type UploadPhoto, usePhotoUploads } from "./use-photo-uploads";

export type PhotosInputProps = {
  upload: UploadPhoto;
  /** The photos the route already has. */
  initialPhotos?: readonly RouteImage[];
  /** Shows saved photos as they are, without `next/image` optimising them. */
  unoptimized?: boolean;
};

export function PhotosInput({
  upload,
  initialPhotos,
  unoptimized,
}: PhotosInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const { photos, uploading, announcement, add, remove, setAlt } =
    usePhotoUploads(upload, initialPhotos);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);

  const editingIndex = photos.findIndex(
    ({ id, status }) => id === editingId && status.state !== "failed",
  );
  const editingPhoto = photos[editingIndex] ?? null;

  useEffect(() => {
    inputRef.current?.setCustomValidity(
      uploading ? "Wait for your photos to finish uploading." : "",
    );
  }, [uploading]);

  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.currentTarget.files ?? []);
    setDragging(false);
    event.currentTarget.value = "";
    add(files);
  }

  function handleRemove(index: number) {
    remove(photos[index].id);

    const next = photos[index + 1] ?? photos[index - 1];
    const target = next
      ? document.getElementById(`${next.id}-remove`)
      : inputRef.current;
    target?.focus();
  }

  function handleAltSave(alt: string) {
    if (editingId) {
      setAlt(editingId, alt);
    }
    setEditingId(null);
  }

  // A photo that fails while its alt text is open loses the button that
  // opened the dialog, which is where focus would return.
  function handleAltClose() {
    if (editingId && !editingPhoto) {
      document.getElementById(`${editingId}-remove`)?.focus();
    }
    setEditingId(null);
  }

  const full = photos.length >= ROUTE_MAX_IMAGES;

  return (
    <fieldset className="fieldset">
      <label className="fieldset-legend" htmlFor="photos">
        Photos <span className="font-normal">(optional)</span>
      </label>
      <div
        className={clsx(
          photos.length > 0 && "grid grid-cols-2 gap-3 sm:grid-cols-3",
        )}
      >
        {photos.length > 0 && (
          // `display: contents` lets the add tile share the grid, and the
          // role keeps the list semantics some browsers drop with it.
          <ol role="list" className="contents">
            {photos.map((photo, index) => (
              <PhotoTile
                key={photo.id}
                photo={photo}
                number={index + 1}
                unoptimized={unoptimized}
                onEditAlt={() => setEditingId(photo.id)}
                onRemove={() => handleRemove(index)}
              />
            ))}
          </ol>
        )}
        {/* When full, the input stays focusable to show its validity message. */}
        <div
          className={
            full
              ? "sr-only"
              : clsx(
                  "relative flex flex-col items-center justify-center gap-2 rounded-box border-2 border-dashed px-4 text-center transition-colors hover:border-primary has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-primary",
                  photos.length > 0 ? "aspect-4/3 py-2" : "min-h-40 py-6",
                  dragging ? "border-primary bg-primary/5" : "border-base-300",
                )
          }
        >
          {photos.length > 0 ? (
            <Plus className="size-6 text-base-content/60" strokeWidth={1.5} />
          ) : (
            <ImagePlus
              className="size-10 text-base-content/60"
              strokeWidth={1.5}
            />
          )}
          <p aria-hidden="true">
            {photos.length === 0 ? (
              <>
                <span className="font-semibold">Add photos of the route</span>
                <br />
                <span className="text-base-content/70">
                  Show people what to expect. Drop photos here, or{" "}
                  <span className="link">choose photos</span>
                </span>
              </>
            ) : (
              <span className="link text-sm">Add photos</span>
            )}
          </p>
          <input
            ref={inputRef}
            id="photos"
            type="file"
            className="absolute inset-0 cursor-pointer opacity-0"
            accept={ROUTE_IMAGE_TYPES.join(",")}
            multiple
            aria-describedby={
              photos.length > 0 ? "photos-hint photos-count" : "photos-hint"
            }
            onChange={handleChange}
            onDragEnter={() => setDragging(true)}
            onDragLeave={() => setDragging(false)}
            onDrop={() => setDragging(false)}
          />
        </div>
      </div>
      <p id="photos-hint" className="label whitespace-normal">
        Up to {ROUTE_MAX_IMAGES} photos. Location data is removed from them.
      </p>
      {photos.length > 0 && (
        <p id="photos-count" className="label">
          {photos.length} of {ROUTE_MAX_IMAGES} photos
        </p>
      )}
      <p className="sr-only" role="status">
        {announcement}
      </p>

      <PhotoAltDialog
        photo={editingPhoto}
        number={editingIndex + 1}
        onSave={handleAltSave}
        onClose={handleAltClose}
      />
    </fieldset>
  );
}

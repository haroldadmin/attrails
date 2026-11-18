"use client";

import { ChevronLeft, ChevronRight, X } from "lucide-react";
import Image from "next/image";
import {
  type KeyboardEvent,
  type MouseEvent,
  type Ref,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import type { RouteImage } from "@/lib/routes/shared";

export type PhotoViewerHandle = {
  show: (index: number) => void;
};

export type PhotoViewerProps = {
  images: RouteImage[];
  /** Shows the photos as they are, without `next/image` optimising them. */
  unoptimized?: boolean;
  onError: (cid: string) => void;
  ref: Ref<PhotoViewerHandle>;
};

/** A full-screen modal for browsing photos, opened with `ref.show(index)`. */
export function PhotoViewer({
  images,
  unoptimized,
  onError,
  ref,
}: PhotoViewerProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const carouselRef = useRef<HTMLUListElement>(null);
  // The photos render on first open so they aren't fetched before then.
  const [opened, setOpened] = useState(false);
  const [current, setCurrent] = useState(0);

  function scrollTo(index: number, behavior?: ScrollBehavior) {
    const carousel = carouselRef.current;
    carousel?.scrollTo({ left: index * carousel.clientWidth, behavior });
  }

  useImperativeHandle(ref, () => ({
    show(index) {
      setOpened(true);
      setCurrent(index);
      dialogRef.current?.showModal();
      scrollTo(index, "instant");
    },
  }));

  function step(delta: number) {
    const next = (current + delta + images.length) % images.length;
    // Wrapping around would otherwise scroll past every photo in between.
    scrollTo(next, Math.abs(next - current) > 1 ? "instant" : undefined);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDialogElement>) {
    if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
      event.preventDefault();
      step(event.key === "ArrowLeft" ? -1 : 1);
    }
  }

  function handleSlideClick(event: MouseEvent<HTMLLIElement>) {
    if (event.target === event.currentTarget) {
      dialogRef.current?.close();
    }
  }

  return (
    <dialog
      ref={dialogRef}
      className="modal bg-black/95"
      aria-label="Photos"
      onKeyDown={handleKeyDown}
    >
      <form method="dialog" className="absolute top-4 right-4 z-10">
        <button type="submit" className="btn btn-circle" aria-label="Close">
          <X className="size-5" />
        </button>
      </form>

      <ul
        ref={carouselRef}
        className="carousel size-full"
        onScroll={(event) =>
          setCurrent(
            Math.round(
              event.currentTarget.scrollLeft / event.currentTarget.clientWidth,
            ),
          )
        }
      >
        {images.map((image) => (
          <li
            key={image.cid}
            className="carousel-item relative box-border size-full items-center justify-center p-4 sm:p-16"
            onClick={handleSlideClick}
          >
            {opened && (
              <Image
                src={image.url}
                alt={image.alt}
                {...dimensions(image)}
                sizes="100vw"
                unoptimized={unoptimized}
                className="h-auto max-h-full w-auto max-w-full object-contain"
                onError={() => onError(image.cid)}
              />
            )}
          </li>
        ))}
      </ul>

      {images.length > 1 && (
        <>
          <p
            className="badge badge-neutral absolute top-6 left-4"
            aria-live="polite"
          >
            <span className="sr-only">Photo </span>
            {current + 1}
            <span aria-hidden="true"> / </span>
            <span className="sr-only"> of </span>
            {images.length}
          </p>
          <button
            type="button"
            className="btn btn-circle absolute top-1/2 left-4 -translate-y-1/2"
            aria-label="Previous photo"
            onClick={() => step(-1)}
          >
            <ChevronLeft className="size-5" />
          </button>
          <button
            type="button"
            className="btn btn-circle absolute top-1/2 right-4 -translate-y-1/2"
            aria-label="Next photo"
            onClick={() => step(1)}
          >
            <ChevronRight className="size-5" />
          </button>
        </>
      )}
    </dialog>
  );
}

/** `next/image` sizing props: the real ratio if known, else fill the parent. */
export function dimensions({ aspectRatio }: RouteImage) {
  return aspectRatio
    ? { width: aspectRatio.width, height: aspectRatio.height }
    : { fill: true };
}

"use client";

import clsx from "clsx";
import Image from "next/image";
import { type CSSProperties, useRef, useState } from "react";
import type { RouteImage } from "@/lib/routes/shared";
import {
  dimensions,
  PhotoViewer,
  type PhotoViewerHandle,
} from "./route-photo-viewer";

// How many photos the mosaic beside the map shows on large screens.
const MOSAIC_PHOTOS = 5;

// Carousel photos are `h-72` (288px) high, and at most `max-w-5/6` of the
// content width so the next one peeks in.
const CAROUSEL_HEIGHT = 288;
const CAROUSEL_MAX_WIDTH = "calc((100vw - 2rem) * 5 / 6)";

// next/image drops small widths from the srcset when `sizes` has a bare `vw`
// value, so they're all inside `calc()`.

// The mosaic column is a third of the page's content width, which is the
// viewport minus padding, capped by the layout's `max-w-7xl`.
const COLUMN_SIZES =
  "(min-width: 1280px) 363px, (min-width: 1024px) calc((100vw - 192px) / 3)";
const HALF_COLUMN_SIZES =
  "(min-width: 1280px) 177px, (min-width: 1024px) calc((100vw - 216px) / 6)";

export type RoutePhotosProps = {
  images: RouteImage[];
};

/**
 * A route's photos: a carousel on small screens, and a mosaic beside the map
 * on large ones. Either opens a full-screen viewer.
 */
export function RoutePhotos({ images }: RoutePhotosProps) {
  const viewerRef = useRef<PhotoViewerHandle>(null);
  const [failed, setFailed] = useState<ReadonlySet<string>>(new Set());

  const photos = images.filter(({ cid }) => !failed.has(cid));
  if (photos.length === 0) {
    return null;
  }

  function handleError(cid: string) {
    setFailed((failed) => new Set(failed).add(cid));
  }

  const count = photos.length;
  const more = count - MOSAIC_PHOTOS;

  return (
    <section
      id="photos"
      aria-labelledby="photos-heading"
      className="flex flex-col gap-6 lg:col-start-3 lg:row-start-1"
    >
      <h2 id="photos-heading" className="font-serif text-3xl lg:sr-only">
        Photos
      </h2>
      <ul
        className={clsx(
          "carousel h-72 w-full gap-2 lg:grid lg:h-[60vh] lg:min-h-80 lg:overflow-visible",
          count === 1 && "lg:grid-cols-1 lg:grid-rows-1",
          count === 2 && "lg:grid-cols-1 lg:grid-rows-2",
          (count === 3 || count === 4) && "lg:grid-cols-2 lg:grid-rows-2",
          count >= MOSAIC_PHOTOS && "lg:grid-cols-2 lg:grid-rows-4",
        )}
      >
        {photos.map((photo, index) => {
          const ratio = photo.aspectRatio
            ? photo.aspectRatio.width / photo.aspectRatio.height
            : 4 / 3;
          const lead = index === 0 && (count === 3 || count >= MOSAIC_PHOTOS);
          const wide = count <= 2 || lead;

          return (
            <li
              key={photo.cid}
              className={clsx(
                "carousel-item aspect-(--ratio) h-full max-w-5/6 lg:aspect-auto lg:max-w-none",
                lead && "lg:col-span-2",
                lead && count >= MOSAIC_PHOTOS && "lg:row-span-2",
                index >= MOSAIC_PHOTOS && "lg:hidden",
              )}
              style={{ "--ratio": ratio } as CSSProperties}
            >
              <button
                type="button"
                className="relative size-full cursor-zoom-in overflow-hidden rounded-box bg-base-200 focus-visible:outline-2 focus-visible:-outline-offset-4 focus-visible:outline-primary"
                aria-haspopup="dialog"
                onClick={() => viewerRef.current?.show(index)}
              >
                <Image
                  src={photo.url}
                  alt={photo.alt}
                  {...dimensions(photo)}
                  sizes={`${wide ? COLUMN_SIZES : HALF_COLUMN_SIZES}, min(${Math.round(CAROUSEL_HEIGHT * ratio)}px, ${CAROUSEL_MAX_WIDTH})`}
                  loading={index === 0 ? "eager" : "lazy"}
                  className="size-full object-cover transition-opacity hover:opacity-90"
                  onError={() => handleError(photo.cid)}
                />
                {!photo.alt && (
                  <span className="sr-only">
                    View photo {index + 1} of {count}
                  </span>
                )}
                {more > 0 && index === MOSAIC_PHOTOS - 1 && (
                  <span className="absolute inset-0 hidden place-items-center bg-black/50 text-3xl font-semibold text-white lg:grid">
                    <span aria-hidden="true">+{more}</span>
                    <span className="sr-only">
                      , and {more} more {more === 1 ? "photo" : "photos"}
                    </span>
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ul>
      <PhotoViewer ref={viewerRef} images={photos} onError={handleError} />
    </section>
  );
}

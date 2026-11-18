import clsx from "clsx";
import { Check, CircleExclamationPoint, Plus, X } from "lucide-react";
import Image from "next/image";
import type { Photo } from "./use-photo-uploads";

const OVERLAY_BUTTON =
  "btn btn-sm absolute top-2 border-0 bg-black/70 text-white shadow-none hover:bg-black/85 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";

export type PhotoTileProps = {
  photo: Photo;
  number: number;
  /** Shows saved photos as they are, without `next/image` optimising them. */
  unoptimized?: boolean;
  onEditAlt: () => void;
  onRemove: () => void;
};

export function PhotoTile({
  photo: { id, previewUrl, alt, status },
  number,
  unoptimized,
  onEditAlt,
  onRemove,
}: PhotoTileProps) {
  const errorId = status.state === "failed" ? `${id}-error` : undefined;
  const settled = status.state === "saved" || status.state === "ready";

  return (
    <li className="flex flex-col gap-1">
      <div className="relative aspect-4/3 overflow-hidden rounded-box bg-base-200">
        {status.state === "saved" ? (
          <Image
            src={previewUrl}
            alt={`Photo ${number}`}
            fill
            sizes="(min-width: 640px) 220px, 50vw"
            unoptimized={unoptimized}
            className="object-cover"
          />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element -- next/image can't optimise local `blob:` URLs.
          <img
            src={previewUrl}
            alt={`Photo ${number}`}
            className={clsx("size-full object-cover", !settled && "opacity-50")}
            aria-describedby={errorId}
          />
        )}

        {status.state === "uploading" && (
          <div className="absolute inset-0 grid place-items-center">
            <span
              className="loading loading-spinner loading-lg text-white drop-shadow"
              aria-hidden="true"
            />
            <span className="sr-only">Uploading photo {number}…</span>
          </div>
        )}

        {status.state === "failed" && (
          <div className="absolute inset-0 grid place-items-center bg-error/40">
            <CircleExclamationPoint className="size-10 text-white drop-shadow" />
          </div>
        )}

        {status.state !== "failed" && (
          <button
            type="button"
            className={clsx(OVERLAY_BUTTON, "left-2 gap-1 rounded-full px-3")}
            aria-label={`${alt ? "Edit" : "Add"} alt text for photo ${number}`}
            onClick={onEditAlt}
          >
            {alt ? (
              <Check className="size-3.5" strokeWidth={3} />
            ) : (
              <Plus className="size-3.5" strokeWidth={3} />
            )}
            ALT
          </button>
        )}

        <button
          id={`${id}-remove`}
          type="button"
          className={clsx(OVERLAY_BUTTON, "btn-circle right-2")}
          aria-label={`Remove photo ${number}`}
          aria-describedby={errorId}
          onClick={onRemove}
        >
          <X className="size-4" strokeWidth={2.5} />
        </button>
      </div>

      {status.state === "failed" && (
        <p id={errorId} className="text-sm text-error">
          {status.error}
        </p>
      )}
      {status.state === "saved" && (
        <input
          type="hidden"
          name="images"
          value={JSON.stringify({ cid: status.cid, alt })}
        />
      )}
      {status.state === "ready" && (
        <input
          type="hidden"
          name="images"
          value={JSON.stringify({ ...status.image, alt })}
        />
      )}
    </li>
  );
}

"use client";

import clsx from "clsx";
import { type ChangeEvent, useState } from "react";
import {
  GPX_MAX_SIZE_BYTES,
  type Gpx,
  GpxError,
  parseGpx,
  serializeGpx,
} from "@/lib/gpx";
import { GPX_TOO_LARGE_MESSAGE, gpxErrorMessage } from "./gpx-messages";

export type GpxFileInputProps = {
  /** Called with the chosen file once it's read, or `null` when it's cleared. */
  onChange: (gpx: Gpx | null) => void;
};

/**
 * A file input for GPX files that users can also drop a file onto. Files over
 * the size limit are replaced with a compact copy when that fits.
 */
export function GpxFileInput({ onChange }: GpxFileInputProps) {
  const [fileName, setFileName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [dragging, setDragging] = useState(false);

  async function handleChange(event: ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget;
    const file = input.files?.[0];
    setDragging(false);
    setFileName(file?.name ?? null);
    setError(null);
    setLoaded(false);
    input.setCustomValidity("");
    onChange(null);

    const result = file ? await readGpxFile(file) : null;
    // A newer file may have been chosen while this one was being read.
    if (input.files?.[0] !== file) {
      return;
    }

    const message = result && "error" in result ? result.error : null;
    input.setCustomValidity(message ?? "");
    setError(message);
    if (!result || "error" in result) {
      return;
    }

    if (result.file !== file) {
      const transfer = new DataTransfer();
      transfer.items.add(result.file);
      input.files = transfer.files;
    }
    setLoaded(true);
    onChange(result.gpx);
  }

  return (
    <fieldset className="fieldset">
      <label className="fieldset-legend" htmlFor="gpx">
        GPX file
      </label>
      <div
        className={clsx(
          "relative rounded-box border-2 border-dashed transition-colors hover:border-primary has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-primary",
          loaded
            ? "px-4 py-3"
            : "flex min-h-48 items-center justify-center px-4 py-8 text-center lg:min-h-96",
          dragging
            ? "border-primary bg-primary/5"
            : error
              ? "border-error"
              : "border-base-300",
        )}
      >
        <p aria-hidden="true">
          {loaded ? (
            <span className="flex flex-wrap items-baseline justify-between gap-x-4">
              <span className="font-semibold break-all">{fileName}</span>
              <span className="link text-sm">Choose a different file</span>
            </span>
          ) : fileName ? (
            <>
              <span className="font-semibold break-all">{fileName}</span>
              <br />
              <span className="text-base-content/70">
                Drop another file here, or{" "}
                <span className="link">choose a different file</span>
              </span>
            </>
          ) : (
            <>
              Drop your GPX file here, or{" "}
              <span className="link">choose a file</span>
            </>
          )}
        </p>
        <input
          id="gpx"
          name="gpx"
          type="file"
          className="absolute inset-0 cursor-pointer opacity-0"
          accept=".gpx,application/gpx+xml"
          aria-invalid={error ? true : undefined}
          aria-describedby="gpx-hint"
          onChange={handleChange}
          onDragEnter={() => setDragging(true)}
          onDragLeave={() => setDragging(false)}
          onDrop={() => setDragging(false)}
          required
        />
      </div>
      <p
        id="gpx-hint"
        className={clsx("label whitespace-normal", error && "text-error")}
        aria-live="polite"
      >
        {error ?? "Export your route as a GPX file from your app or device."}
      </p>
    </fieldset>
  );
}

type ReadResult = { gpx: Gpx; file: File } | { error: string };

async function readGpxFile(file: File): Promise<ReadResult> {
  let gpx;
  try {
    gpx = parseGpx(await file.text());
  } catch (error) {
    if (!(error instanceof GpxError)) {
      console.error(error);
    }
    return {
      error: gpxErrorMessage(
        error instanceof GpxError ? error.reason : "not-gpx",
      ),
    };
  }

  if (file.size <= GPX_MAX_SIZE_BYTES) {
    return { gpx, file };
  }

  const compact = new File([serializeGpx(gpx)], file.name, {
    type: "application/gpx+xml",
  });
  return compact.size <= GPX_MAX_SIZE_BYTES
    ? { gpx, file: compact }
    : { error: GPX_TOO_LARGE_MESSAGE };
}

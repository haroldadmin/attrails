"use client";

import clsx from "clsx";
import convert from "convert";
import { type ChangeEvent, Fragment, useRef, useState } from "react";
import { EXPORT_GUIDES } from "@/app/faq/export-guides";
import { createFormats } from "@/i18n/formats";
import type { Units } from "@/i18n/units";
import {
  GPX_MAX_SIZE_BYTES,
  GPX_TRIM_METERS,
  GPX_TRIM_MIN_METERS,
  type Gpx,
  GpxError,
  parseGpx,
  serializeGpx,
  trimGpx,
} from "@/lib/gpx";
import { GPX_TOO_LARGE_MESSAGE, gpxErrorMessage } from "./gpx-messages";

export type GpxFileInputProps = {
  /** Called with the route as it will be uploaded, or `null` if there's none. */
  onChange: (gpx: Gpx | null) => void;
  locale: string;
  units: Units;
};

type Source = {
  file: File;
  gpx: Gpx;
  trimmed: Gpx | undefined;
};

/**
 * A file input for GPX files that users can also drop a file onto. It always
 * holds the file to upload, which is a compact copy if the route is trimmed or
 * over the size limit.
 */
export function GpxFileInput({ onChange, locale, units }: GpxFileInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [source, setSource] = useState<Source | null>(null);
  const [trim, setTrim] = useState(false);
  const [dragging, setDragging] = useState(false);
  const loaded = source !== null;

  const length = new Intl.NumberFormat(
    locale,
    createFormats(units).number.elevation,
  );
  const inLocalUnits = (meters: number) =>
    length.format(convert(meters, "meters").to(units.elevation));

  function prepareUpload(
    input: HTMLInputElement,
    { file, gpx, trimmed }: Source,
    trim: boolean,
  ) {
    const route = (trim && trimmed) || gpx;
    const upload =
      route === gpx && file.size <= GPX_MAX_SIZE_BYTES
        ? file
        : new File([serializeGpx(route)], file.name, {
            type: "application/gpx+xml",
          });

    if (input.files?.[0] !== upload) {
      const transfer = new DataTransfer();
      transfer.items.add(upload);
      input.files = transfer.files;
    }

    const message =
      upload.size > GPX_MAX_SIZE_BYTES ? GPX_TOO_LARGE_MESSAGE : null;
    input.setCustomValidity(message ?? "");
    setError(message);
    onChange(route);
  }

  async function handleChange(event: ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget;
    const file = input.files?.[0];
    setDragging(false);
    setFileName(file?.name ?? null);
    setError(null);
    setSource(null);
    // The checkbox may still be on, so the raw file mustn't be submitted yet.
    input.setCustomValidity(file ? "This file is still being read." : "");
    onChange(null);

    if (!file) {
      return;
    }

    const result = await readGpxFile(file);
    // A newer file may have been chosen while this one was being read.
    if (input.files?.[0] !== file) {
      return;
    }

    if ("error" in result) {
      input.setCustomValidity(result.error);
      setError(result.error);
      return;
    }

    const source = { file, gpx: result.gpx, trimmed: trimGpx(result.gpx) };
    setSource(source);
    prepareUpload(input, source, trim);
  }

  function handleTrimChange(event: ChangeEvent<HTMLInputElement>) {
    setTrim(event.currentTarget.checked);
    if (source && inputRef.current) {
      prepareUpload(inputRef.current, source, event.currentTarget.checked);
    }
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
          ref={inputRef}
          id="gpx"
          name="gpx"
          type="file"
          className="absolute inset-0 cursor-pointer opacity-0"
          // Only the extension: on iOS, a MIME type here can match a type an
          // installed app declares for GPX, which then disables GPX files.
          accept=".gpx"
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
      {source && (
        <>
          <label className="label mt-2 whitespace-normal text-base-content">
            <input
              type="checkbox"
              className="checkbox"
              checked={trim && source.trimmed !== undefined}
              disabled={!source.trimmed}
              aria-describedby="trim-hint"
              onChange={handleTrimChange}
            />
            Hide the start and end of the route
          </label>
          <p id="trim-hint" className="label whitespace-normal">
            {source.trimmed
              ? `Removes ${inLocalUnits(GPX_TRIM_METERS)} from each end before uploading, so the route doesn't show exactly where you started or finished.`
              : `Only available for routes of ${inLocalUnits(GPX_TRIM_MIN_METERS)} or more.`}
          </p>
        </>
      )}
      {!loaded && (
        <div role="note" className="alert alert-info mt-2">
          <p>
            <strong>Is your route in another app?</strong> Export it as a GPX
            file first. Here&apos;s how in{" "}
            {EXPORT_GUIDES.map((guide, index) => (
              <Fragment key={guide.name}>
                {index > 0 &&
                  (index < EXPORT_GUIDES.length - 1 ? ", " : " or ")}
                <a
                  className="link"
                  href={guide.href}
                  target="_blank"
                  rel="noopener"
                >
                  {guide.name}
                </a>
              </Fragment>
            ))}
            .
          </p>
        </div>
      )}
    </fieldset>
  );
}

type ReadResult = { gpx: Gpx } | { error: string };

async function readGpxFile(file: File): Promise<ReadResult> {
  try {
    return { gpx: parseGpx(await file.text()) };
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
}

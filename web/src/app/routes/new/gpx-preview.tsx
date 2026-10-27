"use client";

import convert from "convert";
import { Detail } from "@/components/detail";
import { RouteMap } from "@/components/route-map";
import { createFormats } from "@/i18n/formats";
import type { Units } from "@/i18n/units";
import {
  type Gpx,
  gpxDistance,
  gpxElevation,
  gpxPath,
  isGpxLoop,
} from "@/lib/gpx";

export type GpxPreviewProps = {
  gpx: Gpx;
  locale: string;
  units: Units;
};

export default function GpxPreview({ gpx, locale, units }: GpxPreviewProps) {
  const isLoop = isGpxLoop(gpx);
  const climb = gpxElevation(gpx);
  const formats = createFormats(units).number;
  const distance = new Intl.NumberFormat(locale, formats.distance);
  const elevation = new Intl.NumberFormat(locale, formats.elevation);

  return (
    <section aria-labelledby="preview-heading" className="flex flex-col gap-4">
      <h2 id="preview-heading" className="font-serif text-2xl">
        Preview
      </h2>

      <RouteMap
        path={gpxPath(gpx)}
        isLoop={isLoop}
        className="h-80 rounded-box"
      />

      <dl className="grid grid-cols-2 sm:grid-cols-4 gap-x-8 gap-y-4">
        <Detail term="Distance">
          {distance.format(
            convert(gpxDistance(gpx), "meters").to(units.distance),
          )}
        </Detail>
        {climb && (
          <>
            <Detail term="Elevation gain">
              {elevation.format(
                convert(climb.gainM, "meters").to(units.elevation),
              )}
            </Detail>
            <Detail term="Elevation loss">
              {elevation.format(
                convert(climb.lossM, "meters").to(units.elevation),
              )}
            </Detail>
          </>
        )}
        <Detail term="Shape">{isLoop ? "Loop" : "Point to point"}</Detail>
      </dl>

      <p className="text-sm text-base-content/70">
        These figures are approximate. Final stats are calculated after upload.
      </p>
    </section>
  );
}

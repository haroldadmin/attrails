"use client";

import * as Plot from "@observablehq/plot";
import convert from "convert";
import { useEffect, useMemo, useRef } from "react";
import type { ElevationSample } from "@/lib/routes/shared";
import { createFormats } from "@/i18n/formats";
import type { Units } from "@/i18n/units";

const HEIGHT = 200;
const MIN_ELEVATION_SPAN = 50;

export type ElevationProfileProps = {
  profile: ElevationSample[];
  locale: string;
  units: Units;
  className?: string;
};

export function ElevationProfile({
  profile,
  locale,
  units,
  className,
}: ElevationProfileProps) {
  const plotRef = useRef<HTMLDivElement>(null);

  const chart = useMemo(
    () => prepareChart(profile, locale, units),
    [profile, locale, units],
  );

  useEffect(() => {
    const container = plotRef.current;
    if (!container) {
      return;
    }

    const styles = getComputedStyle(container);
    const lineColor = styles.getPropertyValue("--color-primary");

    const { samples, lowest, highest, formatDistance, formatElevation } = chart;
    const observer = new ResizeObserver(([entry]) => {
      const width = entry.contentRect.width;
      const plot = Plot.plot({
        width,
        height: HEIGHT,
        marginLeft: 56,
        x: {
          label: "Distance",
          labelAnchor: "center",
          ticks: Math.max(2, Math.floor(width / 100)),
          tickFormat: formatDistance,
        },
        y: {
          label: "Elevation",
          labelAnchor: "center",
          domain: [lowest, Math.max(highest, lowest + MIN_ELEVATION_SPAN)],
          nice: true,
          ticks: 4,
          tickFormat: formatElevation,
          grid: true,
        },
        marks: [
          Plot.areaY(samples, {
            x: "distance",
            y: "elevation",
            fill: lineColor,
            fillOpacity: 0.15,
            clip: true,
          }),
          Plot.lineY(samples, {
            x: "distance",
            y: "elevation",
            stroke: lineColor,
            strokeWidth: 2,
          }),
          Plot.ruleX(
            samples,
            Plot.pointerX({ x: "distance", strokeOpacity: 0.3 }),
          ),
          Plot.dot(
            samples,
            Plot.pointerX({
              x: "distance",
              y: "elevation",
              fill: lineColor,
              r: 4,
            }),
          ),
          Plot.tip(
            samples,
            Plot.pointerX({
              x: "distance",
              y: "elevation",
              title: (sample) =>
                `${formatElevation(sample.elevation)}\n${formatDistance(sample.distance)}`,
            }),
          ),
        ],
      });
      container.replaceChildren(plot);
    });
    observer.observe(container);

    return () => {
      observer.disconnect();
      container.replaceChildren();
    };
  }, [chart]);

  return (
    <figure className={className}>
      <figcaption className="sr-only">
        Elevation profile over {chart.formatDistance(chart.totalDistance)}, from{" "}
        {chart.formatElevation(chart.lowest)} to{" "}
        {chart.formatElevation(chart.highest)}.
      </figcaption>
      <div
        ref={plotRef}
        aria-hidden="true"
        className="[--plot-background:var(--color-base-100)]"
        style={{ height: HEIGHT }}
      />
    </figure>
  );
}

function prepareChart(
  profile: ElevationSample[],
  locale: string,
  units: Units,
) {
  const formats = createFormats(units).number;
  const formatDistance = new Intl.NumberFormat(locale, formats.distance).format;
  const formatElevation = new Intl.NumberFormat(locale, formats.elevation)
    .format;

  const samples = profile.map(([distanceM, elevationM]) => ({
    distance: convert(distanceM, "meters").to(units.distance),
    elevation: convert(elevationM, "meters").to(units.elevation),
  }));
  const elevations = samples.map((sample) => sample.elevation);
  const lowest = Math.min(...elevations);
  const highest = Math.max(...elevations);
  const totalDistance = samples[samples.length - 1].distance;

  return {
    samples,
    lowest,
    highest,
    totalDistance,
    formatDistance,
    formatElevation,
  };
}

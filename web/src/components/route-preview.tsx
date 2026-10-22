import clsx from "clsx";
import type { LineString, MultiLineString } from "geojson";
import { projectPath } from "@/lib/route-path";

// Roughly the rendered size in CSS pixels, so stroke widths map ~1:1.
const SIZE = 112;
const PADDING = 12;

export type RoutePreviewProps = {
  path: LineString | MultiLineString;
  isLoop: boolean;
  className?: string;
};

/**
 * Static SVG outline of a route.
 */
export function RoutePreview({ path, isLoop, className }: RoutePreviewProps) {
  const projected = projectPath(path, {
    width: SIZE,
    height: SIZE,
    padding: PADDING,
  });

  return (
    <svg
      className={clsx("aspect-square bg-base-200 text-primary", className)}
      viewBox={`0 0 ${SIZE} ${SIZE}`}
      aria-hidden="true"
      focusable="false"
    >
      {projected && (
        <>
          <path
            d={projected.d}
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {!isLoop && (
            <circle
              cx={projected.end[0]}
              cy={projected.end[1]}
              r="3"
              className="fill-base-100"
              stroke="currentColor"
              strokeWidth="1.5"
            />
          )}
          <circle
            cx={projected.start[0]}
            cy={projected.start[1]}
            r="3.5"
            fill="currentColor"
            className="stroke-base-100"
            strokeWidth="1.5"
          />
        </>
      )}
    </svg>
  );
}

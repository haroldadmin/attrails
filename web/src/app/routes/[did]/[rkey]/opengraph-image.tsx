import convert from "convert";
import { ImageResponse } from "next/og";
import { getFormatter, getLocale } from "next-intl/server";
import { OG_SIZE, OgCard, ogColors, ogFonts } from "@/components/og-card";
import { unitsForLocale } from "@/i18n/units";
import { activityLabel } from "@/lib/labels";
import { fetchProfile, profileName } from "@/lib/profiles";
import { projectPath } from "@/lib/route-path";
import { fetchRouteCard, type RouteSummary } from "@/lib/routes";
import SiteImage from "@/app/opengraph-image";

const PANEL_WIDTH = 520;
const PANEL_PADDING = 64;
const NAME_LENGTH = 80;

export const alt = "Outline of the route with its distance and climbing";
export const size = OG_SIZE;
export const contentType = "image/png";

export default async function Image({
  params,
}: {
  params: Promise<{ did: string; rkey: string }>;
}) {
  const { did, rkey } = await params;
  const route = await fetchRouteCard(decodeURIComponent(did), rkey);
  // Routes with moderation labels don't get link previews, so they share the
  // site's image.
  if (!route) {
    return SiteImage();
  }

  const [author, format, locale] = await Promise.all([
    fetchProfile(route.did),
    getFormatter(),
    getLocale(),
  ]);
  const units = unitsForLocale(locale);

  const stats = [
    activityLabel(route.activity),
    `${format.number(
      convert(route.distanceM, "meters").to(units.distance),
      "distance",
    )} ${route.isLoop ? "loop" : "route"}`,
    route.elevationGainM !== null &&
      `${format.number(
        convert(route.elevationGainM, "meters").to(units.elevation),
        "elevation",
      )} climbing`,
  ]
    .filter(Boolean)
    .join(" · ");
  const name =
    route.name.length <= NAME_LENGTH
      ? route.name
      : `${route.name.slice(0, NAME_LENGTH - 1).trimEnd()}…`;

  return new ImageResponse(
    <OgCard aside={<RoutePanel route={route} />}>
      <div
        style={{
          fontFamily: "Newsreader",
          fontSize: name.length > 40 ? 56 : 72,
          lineHeight: 1.1,
        }}
      >
        {name}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <div style={{ fontSize: 30, fontWeight: 600 }}>{stats}</div>
        <div style={{ fontSize: 28, color: ogColors.baseContentMuted }}>
          {`Shared by ${profileName(author)}`}
        </div>
      </div>
    </OgCard>,
    { ...size, fonts: [...ogFonts] },
  );
}

function RoutePanel({ route }: { route: RouteSummary }) {
  const projected = projectPath(route.path, {
    width: PANEL_WIDTH,
    height: OG_SIZE.height,
    padding: PANEL_PADDING,
  });

  return (
    <svg
      width={PANEL_WIDTH}
      height={OG_SIZE.height}
      viewBox={`0 0 ${PANEL_WIDTH} ${OG_SIZE.height}`}
      style={{ background: ogColors.base200 }}
    >
      {projected && (
        <>
          <path
            d={projected.d}
            fill="none"
            stroke={ogColors.primary}
            strokeWidth="8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {!route.isLoop && (
            <circle
              cx={projected.end[0]}
              cy={projected.end[1]}
              r="12"
              fill={ogColors.base200}
              stroke={ogColors.primary}
              strokeWidth="6"
            />
          )}
          <circle
            cx={projected.start[0]}
            cy={projected.start[1]}
            r="14"
            fill={ogColors.primary}
            stroke={ogColors.base200}
            strokeWidth="6"
          />
        </>
      )}
    </svg>
  );
}

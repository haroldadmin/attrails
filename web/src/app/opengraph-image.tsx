import { ImageResponse } from "next/og";
import { OG_SIZE, OgCard, ogColors, ogFonts } from "@/components/og-card";

export const alt =
  "ATTrails: discover and share cycling, running, and hiking routes";
export const size = OG_SIZE;
export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(
    <OgCard aside={<Trail />}>
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          columnGap: 22,
          fontFamily: "Newsreader",
          fontSize: 88,
          lineHeight: 1.05,
        }}
      >
        <span>Where will the</span>
        <span style={{ color: ogColors.primary }}>trail</span>
        <span>take you?</span>
      </div>
      <div
        style={{
          fontSize: 32,
          lineHeight: 1.3,
          color: ogColors.baseContentMuted,
        }}
      >
        Discover and share cycling, running, and hiking routes on the open
        social web.
      </div>
    </OgCard>,
    { ...size, fonts: [...ogFonts] },
  );
}

function Trail() {
  return (
    <svg
      width="420"
      height="630"
      viewBox="0 0 420 630"
      style={{ marginRight: 32 }}
    >
      <path
        d="M80 520 C 20 430, 160 400, 190 340 S 100 230, 200 180 S 360 200, 350 100"
        fill="none"
        stroke={ogColors.primary}
        strokeWidth="8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle
        cx="350"
        cy="100"
        r="14"
        fill={ogColors.base100}
        stroke={ogColors.primary}
        strokeWidth="6"
      />
      <circle
        cx="80"
        cy="520"
        r="16"
        fill={ogColors.primary}
        stroke={ogColors.base100}
        strokeWidth="6"
      />
    </svg>
  );
}

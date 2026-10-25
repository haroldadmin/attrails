import "server-only";

import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { ReactNode } from "react";

export const OG_SIZE = { width: 1200, height: 630 };

// Satori can't read CSS variables or oklch, so these mirror the theme in
// globals.css.
export const ogColors = {
  base100: "rgb(245, 242, 235)",
  base200: "rgb(232, 229, 227)",
  baseContent: "rgb(30, 42, 35)",
  baseContentMuted: "rgba(30, 42, 35, 0.7)",
  primary: "#4b7a5a",
};

// Satori can't read woff2, which is all next/font serves. Literal paths let
// the build copy these files into the standalone output.
const [newsreader, newsreaderItalic, sourceSans, sourceSansSemiBold] =
  await Promise.all([
    readFile(
      join(process.cwd(), "src/assets/fonts/newsreader-latin-400-normal.woff"),
    ),
    readFile(
      join(process.cwd(), "src/assets/fonts/newsreader-latin-400-italic.woff"),
    ),
    readFile(
      join(
        process.cwd(),
        "src/assets/fonts/source-sans-3-latin-400-normal.woff",
      ),
    ),
    readFile(
      join(
        process.cwd(),
        "src/assets/fonts/source-sans-3-latin-600-normal.woff",
      ),
    ),
  ]);

export const ogFonts = [
  { name: "Newsreader", data: newsreader, weight: 400, style: "normal" },
  { name: "Newsreader", data: newsreaderItalic, weight: 400, style: "italic" },
  { name: "Source Sans 3", data: sourceSans, weight: 400, style: "normal" },
  {
    name: "Source Sans 3",
    data: sourceSansSemiBold,
    weight: 600,
    style: "normal",
  },
] as const;

/**
 * Frame shared by every Open Graph image: the site background with the
 * wordmark above `children`, and `aside` filling the right edge.
 */
export function OgCard({
  children,
  aside,
}: {
  children: ReactNode;
  aside?: ReactNode;
}) {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        background: ogColors.base100,
        color: ogColors.baseContent,
        fontFamily: "Source Sans 3",
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          flex: 1,
          gap: 40,
          padding: 64,
        }}
      >
        <div
          style={{
            display: "flex",
            fontFamily: "Newsreader",
            fontStyle: "italic",
            fontSize: 40,
          }}
        >
          ATTrails
        </div>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "flex-end",
            flex: 1,
            gap: 24,
          }}
        >
          {children}
        </div>
      </div>
      {aside}
    </div>
  );
}

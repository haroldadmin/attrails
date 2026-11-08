import { clsx } from "clsx";
import Link from "next/link";

export type AtTrailsLogoProps = {
  size: "large" | "small";
};

export function AtTrailsLogo({ size }: AtTrailsLogoProps) {
  return (
    <div>
      <Link
        href="/"
        className={clsx("flex items-center gap-2 font-bold font-serif italic", {
          "text-2xl px-2 py-1": size === "large",
          "text-lg px-1 py-0.5": size === "small",
        })}
      >
        {/* Newsreader's glyphs sit above the line-box centre, so lift the mark to match. */}
        <AtTrailsMark
          size={size === "large" ? 30 : 22}
          className="text-primary shrink-0 -translate-y-1"
        />
        ATTrails
      </Link>
    </div>
  );
}

export type AtTrailsMarkProps = {
  size: number;
  color?: string;
  className?: string;
};

/** The app icon, used alongside the wordmark and in generated images. */
export function AtTrailsMark({
  size,
  color = "currentColor",
  className,
}: AtTrailsMarkProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 512 512"
      role="presentation"
      className={className}
      style={{ display: "block", flexShrink: 0 }}
    >
      <rect width="512" height="512" rx="112" fill={color} />
      <g
        fill="#ffffff"
        stroke="#ffffff"
        strokeWidth="25"
        strokeLinejoin="round"
      >
        <path d="M172 172 L402.5 108.8 L340 340 Z" />
        <path d="M172 172 L340 340 L108.8 402.5 Z" fill="none" />
      </g>
    </svg>
  );
}

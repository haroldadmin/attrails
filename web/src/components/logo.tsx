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
        className={clsx("block font-bold font-serif italic", {
          "text-2xl px-2 py-1": size === "large",
          "text-lg px-1 py-0.5": size === "small",
        })}
      >
        ATTrails
      </Link>
    </div>
  );
}

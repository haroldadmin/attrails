import type { ReactNode } from "react";

export function Detail({
  term,
  children,
}: {
  term: string;
  children: ReactNode;
}) {
  return (
    <div>
      <dt className="text-sm text-base-content/70">{term}</dt>
      <dd className="text-lg font-semibold">{children}</dd>
    </div>
  );
}

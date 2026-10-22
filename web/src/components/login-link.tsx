"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { loginHref } from "@/auth/login-href";

export type LoginLinkProps = {
  className?: string;
  children: ReactNode;
};

/** Links to the login page, coming back to the current page afterwards. */
export function LoginLink({ className, children }: LoginLinkProps) {
  return (
    <Link className={className} href={loginHref(usePathname())}>
      {children}
    </Link>
  );
}

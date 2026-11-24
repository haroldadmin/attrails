"use server";

import { cookies } from "next/headers";
import { getWebUrl } from "@/auth/client";
import { serializeUnits, UNITS_COOKIE, unitsSchema } from "./units";

const UNITS_MAX_AGE_SECONDS = 365 * 24 * 60 * 60; // 1 year

export async function saveUnits(formData: FormData): Promise<void> {
  const units = unitsSchema.safeParse({
    distance: formData.get("distance"),
    elevation: formData.get("elevation"),
  });
  if (!units.success) {
    return;
  }

  const reqCookies = await cookies();
  reqCookies.set(UNITS_COOKIE, serializeUnits(units.data), {
    httpOnly: true,
    sameSite: "lax",
    secure: getWebUrl().protocol === "https:",
    path: "/",
    maxAge: UNITS_MAX_AGE_SECONDS,
  });
}

export async function resetUnits(): Promise<void> {
  const reqCookies = await cookies();
  reqCookies.delete(UNITS_COOKIE);
}

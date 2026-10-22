/** The login page, set up to come back to `returnTo` afterwards. */
export function loginHref(returnTo: string): string {
  return returnTo === "/" || returnTo === "/login"
    ? "/login"
    : `/login?${new URLSearchParams({ returnTo })}`;
}

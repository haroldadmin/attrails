import Link from "next/link";
import { logout } from "@/auth/actions";
import { getOAuthClient } from "@/auth/client";
import { getSession } from "@/auth/session";
import { LoginLink } from "./login-link";

export async function SessionState() {
  const session = await getSession();
  if (!session) {
    return <LoginLink className="link-hover">Log in</LoginLink>;
  }

  const handle = await resolveHandle(session.did);

  return (
    <form action={logout} className="flex flex-row items-center gap-6">
      <Link
        className="link-hover text-base-content/70 max-w-48 truncate"
        href="/users/me"
      >
        {handle ?? session.did}
      </Link>
      <button className="link-hover cursor-pointer" type="submit">
        Log out
      </button>
    </form>
  );
}

async function resolveHandle(did: string): Promise<string | undefined> {
  try {
    const { handle } = await getOAuthClient().identityResolver.resolve(did);
    return handle === "handle.invalid" ? undefined : `@${handle}`;
  } catch {
    return undefined;
  }
}

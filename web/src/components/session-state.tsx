import Link from "next/link";
import { logout } from "@/auth/actions";
import { getOAuthClient } from "@/auth/client";
import { getSession } from "@/auth/session";

export async function SessionState() {
  const session = await getSession();
  if (!session) {
    return (
      <Link className="link-hover" href="/login">
        Log in
      </Link>
    );
  }

  const handle = await resolveHandle(session.did);

  return (
    <form action={logout} className="flex flex-row gap-4">
      <span className="text-base-content/70">{handle ?? session.did}</span>
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

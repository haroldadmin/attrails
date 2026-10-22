import Image from "next/image";
import type { ReactNode } from "react";
import type { AuthorProfile } from "@/lib/profiles";

export type AuthorProps = {
  profile: AuthorProfile;
  children?: ReactNode;
};

export function Author({ profile, children }: AuthorProps) {
  const name = profile.displayName ?? profile.handle ?? profile.did;
  const secondary =
    profile.displayName && profile.handle ? `@${profile.handle}` : null;
  const initial = profile.displayName?.[0] ?? profile.handle?.[0] ?? "?";

  return (
    <div className="flex flex-row items-center gap-3 min-w-0">
      {profile.avatarUrl ? (
        <div className="avatar shrink-0">
          <div className="w-10 rounded-full bg-base-200">
            <Image
              src={profile.avatarUrl}
              alt=""
              width={40}
              height={40}
              unoptimized
            />
          </div>
        </div>
      ) : (
        <div className="avatar avatar-placeholder shrink-0">
          <div className="w-10 rounded-full bg-base-300">
            <span aria-hidden="true">{initial}</span>
          </div>
        </div>
      )}
      <div className="flex flex-col min-w-0 text-sm leading-snug">
        <span className="font-semibold truncate">{name}</span>
        <span className="text-base-content/70 truncate">
          {secondary}
          {secondary && children && " · "}
          {children}
        </span>
      </div>
    </div>
  );
}

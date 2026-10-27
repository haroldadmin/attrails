import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { profileName, type AuthorProfile } from "@/lib/profiles";

export type AuthorProps = {
  profile: AuthorProfile;
  children?: ReactNode;
};

export function Author({ profile, children }: AuthorProps) {
  const secondary =
    profile.displayName && profile.handle ? `@${profile.handle}` : null;

  return (
    <div className="flex flex-row items-center gap-3 min-w-0">
      <Avatar profile={profile} />
      <div className="flex flex-col min-w-0 text-sm leading-snug">
        <Link
          href={`/users/${profile.did}`}
          className="relative font-semibold truncate link-hover"
        >
          {profileName(profile)}
        </Link>
        <span className="text-base-content/70 truncate">
          {secondary}
          {secondary && children && " · "}
          {children}
        </span>
      </div>
    </div>
  );
}

const AVATAR_SIZES = {
  sm: { pixels: 40, className: "w-10" },
  lg: { pixels: 80, className: "w-20 text-3xl" },
};

export type AvatarProps = {
  profile: Pick<AuthorProfile, "displayName" | "handle" | "avatarUrl">;
  size?: keyof typeof AVATAR_SIZES;
};

export function Avatar({ profile, size = "sm" }: AvatarProps) {
  const { pixels, className } = AVATAR_SIZES[size];
  const initial = profile.displayName?.[0] ?? profile.handle?.[0] ?? "?";

  return profile.avatarUrl ? (
    <div className="avatar shrink-0">
      <div className={`${className} rounded-full bg-base-200`}>
        <Image src={profile.avatarUrl} alt="" width={pixels} height={pixels} />
      </div>
    </div>
  ) : (
    <div className="avatar avatar-placeholder shrink-0">
      <div className={`${className} rounded-full bg-base-300`}>
        <span aria-hidden="true">{initial}</span>
      </div>
    </div>
  );
}

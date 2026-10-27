import type { ReactNode } from "react";
import { profileName } from "@/lib/profile-name";
import type { AuthorProfile } from "@/lib/profiles";
import { Avatar } from "./author";

export type ProfileHeaderProps = {
  profile: AuthorProfile;
  /** Actions shown below the bio, e.g. a link to edit the profile. */
  children?: ReactNode;
};

export function ProfileHeader({ profile, children }: ProfileHeaderProps) {
  return (
    <header className="flex flex-col gap-4">
      <div className="flex flex-row items-center gap-4">
        <Avatar profile={profile} size="lg" />
        <div className="flex flex-col min-w-0">
          <h1 className="font-serif text-4xl truncate">
            {profileName(profile)}
          </h1>
          {profile.displayName && profile.handle && (
            <p className="text-base-content/70 truncate">@{profile.handle}</p>
          )}
        </div>
      </div>
      {profile.bio && (
        <p className="max-w-prose whitespace-pre-line">{profile.bio}</p>
      )}
      {children}
    </header>
  );
}

export function ProfileHeaderSkeleton() {
  return (
    <div className="flex flex-row items-center gap-4" aria-hidden="true">
      <div className="skeleton size-20 rounded-full shrink-0" />
      <div className="skeleton h-10 w-64" />
    </div>
  );
}

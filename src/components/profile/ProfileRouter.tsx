"use client";

import { BackendProfilePage } from "@/components/profile/BackendProfilePage";
import { ProfilePage } from "@/components/profile/ProfilePage";
import { useSession } from "@/components/session/SessionProvider";
import { isBackendHandle } from "@/lib/api/adapters";
import type { UserProfile } from "@/types/tiktok";

/**
 * Decides which of the two profile worlds a `/@handle` URL belongs to.
 *
 *   /@123456789012345  → user-service, by id
 *   /@<your handle>    → user-service, as yourself
 *   /@sashtalk         → the cloned mock profile
 *
 * The middle case exists because a handle only identifies an account to
 * auth-service; user-service knows ids and display names, and offers no
 * lookup-by-username. So the only handle that can be resolved is the viewer's
 * own, which the session already holds. Everyone else is addressed by id —
 * which is what `videoToFeedVideo` puts in author links.
 *
 * Mock profiles stay reachable so the cloned UI keeps working with an empty
 * database; the moment the handle belongs to a real account, real data wins.
 */
export function ProfileRouter({
  handle,
  mockProfile,
}: {
  /** The URL segment, with its leading "@" already stripped. */
  handle: string;
  /** The cloned profile for this handle, if the mock data has one. */
  mockProfile: UserProfile | null;
}) {
  const { user, isLoading } = useSession();

  if (isBackendHandle(handle)) {
    return <BackendProfilePage userId={handle} />;
  }

  // Waiting matters: deciding before `/me` settles would render the mock page
  // for the viewer's own handle and then swap it out under them.
  if (isLoading) {
    return (
      <main className="flex h-screen flex-1 items-center justify-center">
        <span className="text-[16px] text-[var(--tt-text-secondary)]">
          Loading profile…
        </span>
      </main>
    );
  }

  if (user && user.username === handle) {
    return <BackendProfilePage />;
  }

  if (mockProfile) return <ProfilePage profile={mockProfile} />;

  return (
    <main className="flex h-screen flex-1 items-center justify-center">
      <p className="text-[16px] text-[var(--tt-text)]">
        Couldn’t find this account.
      </p>
    </main>
  );
}

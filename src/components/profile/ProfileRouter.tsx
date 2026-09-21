"use client";

import { useEffect, useState } from "react";

import { BackendProfilePage } from "@/components/profile/BackendProfilePage";
import { ProfilePage } from "@/components/profile/ProfilePage";
import { ProfileSkeleton } from "@/components/profile/ProfileSkeleton";
import { useSession } from "@/components/session/SessionProvider";
import { isBackendHandle } from "@/lib/api/adapters";
import { getProfileByUsername } from "@/lib/api/users";
import type { UserProfile } from "@/types/tiktok";

/**
 * Decides which of the two profile worlds a `/@handle` URL belongs to.
 *
 *   /@123456789012345  → user-service, by id
 *   /@<any real handle> → user-service, by handle
 *   /@sashtalk         → the cloned mock profile
 *
 * Both spellings reach the same account: an id is answered straight away, a
 * handle costs one lookup (`GET /users/by-username/{handle}`) because
 * user-service stores profiles by id. Links elsewhere in the app carry
 * whichever they happen to hold — `videoToFeedVideo` puts an id in author
 * links, a notification row shows the actor's handle.
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
  /**
   * What the last lookup answered, tagged with the handle it answered for —
   * a bare id would still be on screen for one render after the URL changed
   * to a different handle, and resetting it in the effect is a cascading
   * render. `id: null` means the lookup ran and found nothing.
   */
  const [resolved, setResolved] = useState<{
    handle: string;
    id: string | null;
  } | null>(null);

  const isOwnHandle = Boolean(user && user.username === handle);
  // Skipped for an id (nothing to resolve) and for the viewer's own handle
  // (the session already holds it), so the lookup only pays for other people.
  const needsLookup = !isBackendHandle(handle) && !isLoading && !isOwnHandle;

  useEffect(() => {
    if (!needsLookup) return;
    let cancelled = false;
    getProfileByUsername(handle)
      .then((profile) => {
        if (!cancelled) setResolved({ handle, id: profile.userId });
      })
      .catch(() => {
        // 404, or signed out: no real account behind this handle, so whatever
        // the mock data has is the best answer left.
        if (!cancelled) setResolved({ handle, id: null });
      });
    return () => {
      cancelled = true;
    };
  }, [handle, needsLookup]);

  if (isBackendHandle(handle)) {
    return <BackendProfilePage userId={handle} />;
  }

  // Waiting matters: deciding before `/me` settles would render the mock page
  // for the viewer's own handle and then swap it out under them.
  if (isLoading) {
    return <ProfileSkeleton />;
  }

  if (isOwnHandle) {
    return <BackendProfilePage />;
  }

  const lookup = resolved?.handle === handle ? resolved : null;
  if (!lookup) {
    return <ProfileSkeleton />;
  }

  if (lookup.id !== null) {
    return <BackendProfilePage userId={lookup.id} />;
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

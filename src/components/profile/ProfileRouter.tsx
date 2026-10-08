"use client";

import { useEffect, useState } from "react";

import { BackendProfilePage } from "@/components/profile/BackendProfilePage";
import { ProfileSkeleton } from "@/components/profile/ProfileSkeleton";
import { useSession } from "@/components/session/SessionProvider";
import { isBackendHandle } from "@/lib/api/adapters";
import { getProfileByUsername } from "@/lib/api/users";

/**
 * Resolves a `/@handle` URL to a user-service account.
 *
 *   /@123456789012345  → by id
 *   /@<any real handle> → by handle
 *
 * Both spellings reach the same account: an id is answered straight away, a
 * handle costs one lookup (`GET /users/by-username/{handle}`) because
 * user-service stores profiles by id. Links elsewhere in the app carry
 * whichever they happen to hold — `videoToFeedVideo` puts an id in author
 * links, a notification row shows the actor's handle.
 */
export function ProfileRouter({
  handle,
}: {
  /** The URL segment, with its leading "@" already stripped. */
  handle: string;
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
        // 404, or signed out: no account to show behind this handle.
        if (!cancelled) setResolved({ handle, id: null });
      });
    return () => {
      cancelled = true;
    };
  }, [handle, needsLookup]);

  if (isBackendHandle(handle)) {
    return <BackendProfilePage userId={handle} />;
  }

  // Waiting matters: deciding before `/me` settles would look the viewer's own
  // handle up as a stranger's and then swap the page out under them.
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

  return (
    <main className="flex h-screen flex-1 items-center justify-center">
      <p className="text-[16px] text-[var(--tt-text)]">
        Couldn’t find this account.
      </p>
    </main>
  );
}

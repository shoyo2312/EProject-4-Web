"use client";

import { useCallback, useEffect, useState } from "react";

import { useSession } from "@/components/session/SessionProvider";
import { toast } from "@/components/ui/toast";
import { messageFor } from "@/lib/api/errors";
import type { UserSettingsResponse } from "@/lib/api/types";
import { getMySettings, updateMySettings } from "@/lib/api/users";

export interface AccountSettings {
  /** Null while signed out, while loading, and after a failed read. */
  settings: UserSettingsResponse | null;
  /** Saves the given keys and adopts the server's whole answer. Throws `ApiError`. */
  update: (patch: Partial<UserSettingsResponse>) => Promise<void>;
}

/**
 * The viewer's `user_settings`, read once for the whole `/setting` page — the
 * rows that show them are siblings, so one read feeds all of them.
 */
export function useAccountSettings(): AccountSettings {
  const { user } = useSession();
  const userId = user?.userId ?? null;
  const [loaded, setLoaded] = useState<{
    userId: string;
    value: UserSettingsResponse;
  } | null>(null);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;

    getMySettings().then(
      (value) => {
        if (!cancelled) setLoaded({ userId, value });
      },
      (cause) => {
        if (!cancelled) toast.error(messageFor(cause));
      },
    );

    return () => {
      cancelled = true;
    };
  }, [userId]);

  const update = useCallback(
    async (patch: Partial<UserSettingsResponse>) => {
      if (!userId) return;
      const value = await updateMySettings(patch);
      setLoaded({ userId, value });
    },
    [userId],
  );

  // Keyed by owner rather than cleared on sign-out, so a second account signing
  // in on this tab never sees the first one's answers while its own load.
  const settings = loaded?.userId === userId ? loaded.value : null;

  return { settings, update };
}

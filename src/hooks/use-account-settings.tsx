"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import { useSession } from "@/components/session/SessionProvider";
import { toast } from "@/components/ui/toast";
import { messageFor } from "@/lib/api/errors";
import type { UserSettingsPatch, UserSettingsResponse } from "@/lib/api/types";
import { getMySettings, updateMySettings } from "@/lib/api/users";

export interface AccountSettings {
  /** Null while signed out, while loading, and after a failed read. */
  settings: UserSettingsResponse | null;
  /** Saves the given keys and adopts the server's whole answer. Throws `ApiError`. */
  update: (patch: UserSettingsPatch) => Promise<void>;
}

const AccountSettingsContext = createContext<AccountSettings | null>(null);

/**
 * The viewer's `user_settings`, read once for the whole app: the `/setting`
 * rows show them, and the notification gates and the screen-time guard act on
 * them on every page. One copy, so a save on `/setting` is what the rest of
 * the app sees next.
 */
export function AccountSettingsProvider({ children }: { children: React.ReactNode }) {
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
    async (patch: UserSettingsPatch) => {
      if (!userId) return;
      const value = await updateMySettings(patch);
      setLoaded({ userId, value });
    },
    [userId],
  );

  // Keyed by owner rather than cleared on sign-out, so a second account signing
  // in on this tab never sees the first one's answers while its own load.
  const settings = loaded?.userId === userId ? loaded.value : null;
  const context = useMemo(() => ({ settings, update }), [settings, update]);

  return (
    <AccountSettingsContext.Provider value={context}>{children}</AccountSettingsContext.Provider>
  );
}

export function useAccountSettings(): AccountSettings {
  const context = useContext(AccountSettingsContext);
  if (!context) throw new Error("useAccountSettings needs an AccountSettingsProvider above it");
  return context;
}

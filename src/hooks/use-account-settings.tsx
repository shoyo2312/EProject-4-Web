"use client";

import { usePathname } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
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
 * The viewer's `user_settings`, shared by the whole app: the `/setting` rows
 * show them, and the notification gates and the screen-time guard act on them
 * on every page. One copy, so a save on `/setting` is what the rest of the app
 * sees next.
 *
 * Read on sign-in and again whenever the tab comes back into view: that picks
 * up a change made in another tab (a new daily limit, say), and recovers from
 * a first read that failed — a cold load can trip the gateway's per-IP rate
 * limit — which would otherwise leave every switch and limit dead until a
 * reload. A failed read says so only on /setting, where its rows go blank;
 * anywhere else the next read quietly tries again.
 */
export function AccountSettingsProvider({ children }: { children: React.ReactNode }) {
  const { user } = useSession();
  const userId = user?.userId ?? null;
  const [loaded, setLoaded] = useState<{
    userId: string;
    value: UserSettingsResponse;
  } | null>(null);
  const pathname = usePathname();
  const onSettingsPage = useRef(false);
  /** Counts saves that landed; a read sent before the latest one answers stale. */
  const saves = useRef(0);

  useEffect(() => {
    onSettingsPage.current = pathname === "/setting" || pathname?.startsWith("/setting/") === true;
  }, [pathname]);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;

    const read = () => {
      const savesBefore = saves.current;
      getMySettings().then(
        (value) => {
          if (!cancelled && saves.current === savesBefore) setLoaded({ userId, value });
        },
        (cause) => {
          if (!cancelled && onSettingsPage.current) toast.error(messageFor(cause));
        },
      );
    };

    read();
    const onVisible = () => {
      if (document.visibilityState === "visible") read();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [userId]);

  const update = useCallback(
    async (patch: UserSettingsPatch) => {
      if (!userId) return;
      const value = await updateMySettings(patch);
      saves.current += 1;
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

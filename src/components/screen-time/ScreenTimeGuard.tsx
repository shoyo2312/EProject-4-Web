"use client";

import { usePathname } from "next/navigation";
import { useEffect, useReducer, useRef, useState } from "react";

import { ScreenTimeLimitOverlay } from "@/components/screen-time/ScreenTimeLimitOverlay";
import { useSession } from "@/components/session/SessionProvider";
import { toast } from "@/components/ui/toast";
import { useAccountSettings } from "@/hooks/use-account-settings";
import { getScreenTimeWeek, sendScreenTimeHeartbeat } from "@/lib/api/screen-time";
import { todayLimitMinutes } from "@/lib/settings/account-settings";
import {
  isLocked,
  localDate,
  sleepReminderDue,
  weekStartOf,
} from "@/lib/settings/screen-time";

/** How often the page counts, in seconds. */
const TICK_SECONDS = 15;
/** Counted time goes to the server once there is this much of it. */
const SEND_AT_SECONDS = 60;
/** The most one heartbeat may carry; the server clamps there too. */
const MAX_PENDING_SECONDS = 120;

const unlockKey = (userId: string) => `nowa:screen-time-unlocked:${userId}`;

/** The day the passcode was last entered on this browser, "YYYY-MM-DD". */
function unlockedDate(userId: string): string | null {
  try {
    return localStorage.getItem(unlockKey(userId));
  } catch {
    return null;
  }
}

function rememberUnlock(userId: string, date: string): void {
  try {
    localStorage.setItem(unlockKey(userId), date);
  } catch {
    // Storage blocked: the screen comes back on the next load, the passcode still works.
  }
}

const SLEEP_REMINDER = "Sleep hours start in 10 minutes";

/**
 * Marks a night's reminder as shown, in storage so another tab or a reload
 * does not show it again. False when it already was.
 */
function claimReminder(key: string, shown: Set<string>): boolean {
  if (shown.has(key)) return false;
  shown.add(key);
  try {
    if (localStorage.getItem(key)) return false;
    localStorage.setItem(key, "1");
  } catch {
    // Storage blocked: `shown` still keeps it to once on this page.
  }
  return true;
}

/**
 * Measures time on the site for Screen time, and holds the daily limit.
 *
 * Every 15 seconds the tab is in view and focused counts, and each minute of
 * it goes to user-service with the browser's time zone, which is what decides
 * day time from night time. A send that fails keeps its seconds for the next
 * try, up to the 120 one heartbeat may carry: a long outage loses time rather
 * than reporting it all at once afterwards.
 *
 * With a limit and a passcode set, today's total — read from the server when
 * this mounts, when the tab comes back into view and when the day turns, plus
 * what this tab counted since — puts `ScreenTimeLimitOverlay` over every page
 * but /setting once it reaches the limit. The passcode lifts it for the rest of
 * the day on this browser.
 *
 * With sleep hours set, a toast says so ten minutes before they start, once a
 * night, while the site is in view. Their start is `SleepHoursScreen`'s.
 */
export function ScreenTimeGuard() {
  const { user } = useSession();
  const { settings } = useAccountSettings();
  const pathname = usePathname() ?? "";
  const userId = user?.userId ?? null;
  const [now, setNow] = useState(() => new Date());
  /** Today's total on the server, for one viewer and day. */
  const [base, setBase] = useState<{ key: string; seconds: number } | null>(null);
  /** Seconds this tab counted since `base` was read. */
  const [counted, setCounted] = useState(0);
  /** Re-renders after an unlock is written, so storage is read again. */
  const [, unlocked] = useReducer((count: number) => count + 1, 0);
  /** Time behind the lock screen is not time on the app. */
  const lockedRef = useRef(false);
  /** Read by the ticks, which outlive any one render. */
  const sleepStartRef = useRef<string | null>(null);

  const today = localDate(now);
  const limit = settings ? todayLimitMinutes(settings, now) : null;
  const guarded = userId !== null && limit !== null && settings?.hasScreenTimePasscode === true;

  useEffect(() => {
    sleepStartRef.current = settings?.sleepHoursStart ?? null;
  }, [settings]);

  useEffect(() => {
    if (!userId) return;
    let pending = 0;
    let sending = false;
    const reminded = new Set<string>();

    const timer = window.setInterval(() => {
      if (document.visibilityState !== "visible") return;

      const start = sleepStartRef.current;
      const night = start ? sleepReminderDue(start, new Date()) : null;
      if (night && claimReminder(`nowa:sleep-reminder:${userId}:${night}`, reminded)) {
        toast(SLEEP_REMINDER);
      }

      if (!document.hasFocus() || lockedRef.current) return;
      setNow(new Date());
      setCounted((seconds) => seconds + TICK_SECONDS);
      pending = Math.min(pending + TICK_SECONDS, MAX_PENDING_SECONDS);
      if (sending || pending < SEND_AT_SECONDS) return;

      const seconds = pending;
      pending = 0;
      sending = true;
      sendScreenTimeHeartbeat(seconds, Intl.DateTimeFormat().resolvedOptions().timeZone)
        .catch(() => {
          pending = Math.min(pending + seconds, MAX_PENDING_SECONDS);
        })
        .finally(() => {
          sending = false;
        });
    }, TICK_SECONDS * 1000);

    return () => window.clearInterval(timer);
  }, [userId]);

  useEffect(() => {
    if (!guarded) return;
    let cancelled = false;

    const read = () => {
      const at = new Date();
      getScreenTimeWeek(weekStartOf(at)).then(
        (week) => {
          if (cancelled) return;
          const date = localDate(at);
          const day = week.days.find((entry) => entry.date === date);
          setBase({
            key: `${userId}:${date}`,
            seconds: day ? day.daySeconds + day.nightSeconds : 0,
          });
          setCounted(0);
        },
        // Unread, nothing locks: the limit is a nudge, not a wall worth an outage.
        () => {},
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
  }, [guarded, userId, today]);

  const todaySeconds =
    userId !== null && base?.key === `${userId}:${today}` ? base.seconds + counted : null;
  const locked =
    guarded &&
    userId !== null &&
    todaySeconds !== null &&
    isLocked({
      todaySeconds,
      limitMinutes: limit,
      hasPasscode: true,
      unlockedDate: unlockedDate(userId),
      today,
      pathname,
    });

  useEffect(() => {
    lockedRef.current = locked;
  }, [locked]);

  if (!locked || userId === null) return null;

  return (
    <ScreenTimeLimitOverlay
      onUnlock={() => {
        rememberUnlock(userId, today);
        unlocked();
      }}
    />
  );
}

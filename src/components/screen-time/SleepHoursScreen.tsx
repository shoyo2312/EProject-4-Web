"use client";

import { useEffect, useReducer, useRef, useState } from "react";

import { NowaWordmark } from "@/components/layout/NowaWordmark";
import { useSession } from "@/components/session/SessionProvider";
import { toast } from "@/components/ui/toast";
import { useAccountSettings } from "@/hooks/use-account-settings";
import { useFocusTrap } from "@/hooks/use-focus-trap";
import { inSleepHours, SLEEP_SNOOZE_MS } from "@/lib/settings/sleep-hours";

/** How often the clock is checked against the window, so the screen comes up on time. */
const TICK_MS = 30_000;

const snoozeKey = (userId: string) => `tt:sleep-hours-snooze:${userId}`;

/**
 * When "Return for now" lets the screen back, in epoch millis. Kept in storage,
 * not state, so a reload or a second tab does not bring it straight back.
 */
function snoozedUntil(userId: string): number {
  try {
    return Number(localStorage.getItem(snoozeKey(userId))) || 0;
  } catch {
    return 0;
  }
}

function snooze(userId: string, until: number): void {
  try {
    localStorage.setItem(snoozeKey(userId), String(until));
  } catch {
    // Storage blocked: the screen stays away until the next tick re-reads it.
  }
}

/**
 * The screen TikTok puts over the whole site once the viewer's sleep hours
 * start. Measured live at 1920 × 936:
 *   layer    fixed, #000, above every modal
 *   header   60 tall, `padding: 0 24px 0 16px`, logo 118 × 42, avatar 32
 *   body     `padding: 200px 32px 32px`, centred: moon 50, 12, title
 *            80/96/700 #F6F6F6, 12, line 20/25/500 `.88`, 40, button
 *            244 × 40, radius 6, white, 16/24/500 black
 *   art      a 1299-wide picture centred behind it; this one is drawn in CSS,
 *            since the live one is TikTok's own artwork
 * "Return for now" lets the viewer back for an hour, with a toast saying so.
 */
export function SleepHoursScreen() {
  const { user } = useSession();
  const { settings } = useAccountSettings();
  const [now, setNow] = useState(() => Date.now());
  /** Re-renders after a snooze is written, so storage is read again. */
  const [, snoozed] = useReducer((count: number) => count + 1, 0);
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), TICK_MS);
    return () => window.clearInterval(timer);
  }, []);

  const asleep =
    user !== null &&
    inSleepHours(settings?.sleepHoursStart ?? null, new Date(now)) &&
    now >= snoozedUntil(user.userId);

  useFocusTrap(dialogRef, asleep);

  // Nothing keeps playing under the screen.
  useEffect(() => {
    if (asleep) document.querySelectorAll("video").forEach((video) => video.pause());
  }, [asleep]);

  if (!asleep) return null;

  const returnForNow = () => {
    snooze(user.userId, Date.now() + SLEEP_SNOOZE_MS);
    snoozed();
    toast("We’ll remind you again after 1 hour on Nowa");
  };

  return (
    // Above `Modal`'s 3001: a dialog left open at the start is covered too.
    // `aria-modal` also stops the feed's arrow-key shortcuts (`useHotkeys`).
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby="sleep-hours-title"
      className="fixed inset-0 z-[3002] overflow-hidden bg-black text-center"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-y-0 left-1/2 w-[1300px] max-w-full -translate-x-1/2 bg-[radial-gradient(ellipse_45%_40%_at_62%_28%,rgb(18_92_104/0.45),transparent),radial-gradient(ellipse_40%_35%_at_38%_78%,rgb(70_46_140/0.4),transparent),repeating-linear-gradient(90deg,rgb(255_255_255/0.035)_0_2px,transparent_2px_72px)] [mask-image:radial-gradient(ellipse_70%_60%_at_50%_50%,black,transparent)]"
      />

      <header className="relative flex h-[60px] items-center justify-between bg-black pr-6 pl-4">
        <NowaWordmark className="h-[42px] w-auto text-white" />
        {/* eslint-disable-next-line @next/next/no-img-element -- avatars come from an arbitrary CDN host, which next/image would have to allow-list */}
        <img
          src={user.avatarUrl}
          alt=""
          referrerPolicy="no-referrer"
          width={32}
          height={32}
          className="h-8 w-8 rounded-full object-cover"
        />
      </header>

      <div className="relative px-8 pt-[min(200px,18vh)] pb-8">
        <MoonIcon className="mx-auto h-[50px] w-[50px]" />
        <h1
          id="sleep-hours-title"
          className="mt-3 text-[clamp(44px,11vw,80px)] leading-[1.2] font-bold text-[#f6f6f6]"
        >
          Sleep hours
        </h1>
        <p className="mt-3 text-[20px] leading-[25px] font-medium text-[rgb(255_255_255/0.88)]">
          Unwind with a breathing exercise for a good night’s sleep.
        </p>
        <button
          type="button"
          onClick={returnForNow}
          className="mt-10 h-10 w-[244px] max-w-full rounded-[6px] bg-white py-2 text-[16px] leading-6 font-medium text-black transition-colors hover:bg-white/90"
        >
          Return for now
        </button>
      </div>
    </div>
  );
}

/** A crescent, lit from the lower left as on the live screen. */
function MoonIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 50 50" aria-hidden="true" className={className}>
      <mask id="sleep-hours-moon">
        <rect width="50" height="50" fill="white" />
        <circle cx="35" cy="15" r="15" fill="black" />
      </mask>
      <circle cx="25" cy="25" r="19" fill="#e9e9e9" mask="url(#sleep-hours-moon)" />
    </svg>
  );
}

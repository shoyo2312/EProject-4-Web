"use client";

import { useEffect, useRef, useState } from "react";

import { ScreenTimeIcon } from "@/components/icons";
import { NowaWordmark } from "@/components/layout/NowaWordmark";
import { CodeBoxes } from "@/components/session/auth-modal/CodeBoxes";
import { useSession } from "@/components/session/SessionProvider";
import { useFocusTrap } from "@/hooks/use-focus-trap";
import { messageFor } from "@/lib/api/errors";
import { verifyScreenTimePasscode } from "@/lib/api/screen-time";
import { emptyCode } from "@/lib/forms/code-digits";
import { holdPlayback } from "@/lib/playback-hold";

const PASSCODE_LENGTH = 4;

/**
 * Covers the whole site once today's time reaches the daily limit, with the
 * passcode as the only way past it (Settings stays open; the guard does not
 * mount this there).
 *
 * TikTok's own screen was not observed — it only shows to an account with a
 * limit — so this follows its Sleep hours screen, measured live at 1920 × 936:
 * a black layer above every modal, a 60px header with the logo and the
 * viewer's avatar, and a centred column 200px down — glyph, bold title, a
 * 20/25/500 line at `.88`, then the control.
 */
export function ScreenTimeLimitOverlay({ onUnlock }: { onUnlock: () => void }) {
  const { user } = useSession();
  const [digits, setDigits] = useState(() => emptyCode(PASSCODE_LENGTH));
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const firstBox = useRef<HTMLInputElement>(null);
  useFocusTrap(dialogRef, true);

  // Nothing plays under the cover: the feed's cards and the story player hold
  // still (and count no watching) until it lifts, and any other media that
  // starts — a preview, say — is stopped as it does.
  useEffect(() => {
    const release = holdPlayback();
    const stop = (event: Event) => {
      if (event.target instanceof HTMLMediaElement) event.target.pause();
    };
    document.querySelectorAll<HTMLMediaElement>("video, audio").forEach((media) => media.pause());
    document.addEventListener("play", stop, true);
    return () => {
      release();
      document.removeEventListener("play", stop, true);
    };
  }, []);

  // Once the boxes take input again — on opening, and after a wrong passcode,
  // when they were disabled while it was checked — the keyboard is on the first.
  useEffect(() => {
    if (!checking) firstBox.current?.focus();
  }, [checking]);

  const onChange = async (next: string[]) => {
    setDigits(next);
    const passcode = next.join("");
    if (passcode.length < PASSCODE_LENGTH) return;

    setChecking(true);
    setError(null);
    try {
      if (await verifyScreenTimePasscode(passcode)) return onUnlock();
      setError("Incorrect passcode");
    } catch (cause) {
      setError(messageFor(cause));
    }
    setChecking(false);
    setDigits(emptyCode(PASSCODE_LENGTH));
  };

  return (
    // Above `Modal`'s 3001 and the Sleep hours screen: this one has to be answered.
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby="screen-time-limit-title"
      className="fixed inset-0 z-[3003] overflow-y-auto bg-black text-center"
    >
      <header className="flex h-[60px] items-center justify-between pr-6 pl-4">
        <NowaWordmark className="h-[42px] w-auto text-white" />
        {user?.avatarUrl && (
          // eslint-disable-next-line @next/next/no-img-element -- avatars come from an arbitrary CDN host, which next/image would have to allow-list
          <img
            src={user.avatarUrl}
            alt=""
            referrerPolicy="no-referrer"
            width={32}
            height={32}
            className="h-8 w-8 rounded-full object-cover"
          />
        )}
      </header>

      <div className="px-8 pt-[min(200px,18vh)] pb-8">
        <ScreenTimeIcon className="mx-auto h-[50px] w-[50px] text-[#e9e9e9]" />
        <h1
          id="screen-time-limit-title"
          className="mx-auto mt-3 max-w-[900px] text-[clamp(32px,6vw,56px)] leading-[1.2] font-bold text-[#f6f6f6]"
        >
          You’ve reached your daily screen time limit
        </h1>
        <p className="mt-3 text-[20px] leading-[25px] font-medium text-[rgb(255_255_255/0.88)]">
          Enter your passcode to keep using Nowa today.
        </p>
        <div className="mt-10 flex justify-center">
          <CodeBoxes
            digits={digits}
            onChange={(next) => void onChange(next)}
            disabled={checking}
            invalid={error !== null}
            firstRef={firstBox}
          />
        </div>
        {error && (
          <p role="alert" className="mt-3 text-[14px] leading-5 text-[rgb(255_76_58)]">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}

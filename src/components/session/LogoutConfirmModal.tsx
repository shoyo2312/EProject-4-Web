"use client";

import { useId } from "react";

import { modalCardMotion, modalOverlayMotion } from "@/components/ui/modal";
import { useEscapeKey } from "@/hooks/use-escape-key";
import { cn } from "@/lib/utils";

/** The live `Button` at `size: "small"`, widened to 164 × 48 for this modal. */
const BUTTON =
  "flex h-12 w-[164px] items-center justify-center rounded-[4px] border bg-white/[0.08] px-2.5 text-[16px] leading-[22px] font-semibold select-none focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[rgb(255_76_58)]";

/**
 * `.DivLogoutConfirmContainer` — the "Are you sure you want to log out?" step
 * the live site puts between the "Log out" menu item and the logout itself.
 * Read from its styles and the `Button` it uses, in the dark theme:
 *
 *   card     400 wide, padding 32, #252525, radius 8, a 1px border that the
 *            dark theme leaves transparent, 0 2px 8px rgba(0, 0, 0, .06)
 *   title    24/30/700 (`P0` bold), centred, padding 0 32 — two lines
 *   buttons  a 336 row 16 below the title, two 164 × 48 buttons at 16/22/600,
 *            radius 4, 1px border, rgba(255, 255, 255, .08) behind
 *            Cancel   `default` — white .9 on a transparent border;
 *                     :hover #121212 inside an rgb(208, 209, 211) border
 *            Log out  `line` — #FF3B5C text and border;
 *                     :hover rgba(254, 44, 85, .06), :active .16
 *   focus    a 2px rgb(255, 76, 58) ring, 1px out
 *
 * The row is 2px wider than the card's content box, so it hangs 1px into the
 * padding on either side; `-mx-px` keeps that and still lets it narrow on a
 * phone.
 */
export function LogoutConfirmModal({
  closing,
  onCancel,
  onConfirm,
}: {
  /** Closed and on its way out: still on screen for `MODAL_EXIT_MS`, but no longer answering. */
  closing: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const titleId = useId();
  useEscapeKey(onCancel, !closing);

  return (
    <div
      inert={closing || undefined}
      className={cn(
        "fixed inset-0 z-[3001] flex items-center justify-center",
        modalOverlayMotion(closing),
      )}
    >
      <button
        type="button"
        aria-label="Cancel"
        onClick={onCancel}
        className="absolute inset-0 cursor-default bg-black/[0.68]"
      />

      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={cn(
          "relative flex w-[400px] max-w-[calc(100vw-2rem)] flex-col items-center rounded-[8px] border border-transparent bg-[#252525] p-8 shadow-[0_2px_8px_rgba(0,0,0,0.06)]",
          modalCardMotion(closing),
        )}
      >
        <h2
          id={titleId}
          className="w-full px-8 text-center text-[24px] leading-[30px] font-bold text-[var(--tt-text)]"
        >
          Are you sure you want to log out?
        </h2>

        <div className="-mx-px mt-4 flex w-[calc(100%+2px)] gap-2">
          <button
            type="button"
            onClick={onCancel}
            className={cn(
              BUTTON,
              "border-transparent text-[var(--tt-text)] hover:border-[rgb(208_209_211)] hover:bg-[#121212] active:border-[rgb(208_209_211)] active:bg-white/[0.08]",
            )}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={cn(
              BUTTON,
              "border-[var(--tt-red-active)] text-[var(--tt-red-active)] hover:bg-[rgb(254_44_85/0.06)] active:bg-[rgb(254_44_85/0.16)]",
            )}
          >
            Log out
          </button>
        </div>
      </div>
    </div>
  );
}

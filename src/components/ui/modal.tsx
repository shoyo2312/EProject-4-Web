"use client";

import { createPortal } from "react-dom";

import { useEscapeKey } from "@/hooks/use-escape-key";
import { useMounted } from "@/hooks/use-mounted";
import { cn } from "@/lib/utils";

/*
 * TikTok's modal motion, from the live `.DivModalContainer` and
 * `.DivContentContainer` that the login modal and the logout confirm are both
 * built on: the whole modal, mask included, fades over 500ms while the card
 * grows from scale(.1) over 300ms, both on cubic-bezier(.075, .82, .165, 1).
 * Closing runs both back, and the modal is removed when the card's ends —
 * the fade is cut off at ~.03 rather than waited for.
 */

/** How long a closing modal stays mounted — the card's 300ms. */
export const MODAL_EXIT_MS = 300;

/** For the fixed layer holding the mask and the card. */
export function modalOverlayMotion(closing: boolean): string {
  return cn(
    "transition-opacity duration-500 ease-[cubic-bezier(0.075,0.82,0.165,1)] starting:opacity-0",
    closing && "opacity-0",
  );
}

/** For the card itself. */
export function modalCardMotion(closing: boolean): string {
  return cn(
    "transition-transform duration-300 ease-[cubic-bezier(0.075,0.82,0.165,1)] starting:scale-10",
    closing && "scale-10",
  );
}

/** Centered modal shell, matching the house style (see `EditProfileModal`). */
export function Modal({
  onClose,
  className = "w-[340px] rounded-[12px] p-6",
  children,
}: {
  onClose: () => void;
  /**
   * Size/padding/radius of the sheet. Defaults to the narrow confirm shell;
   * the report flow passes the live site's 700px one instead.
   */
  className?: string;
  children: React.ReactNode;
}) {
  useEscapeKey(onClose);

  /* Rendered into <body>: callers mount this deep inside rows that carry
     `content-visibility: auto` (paint containment), which makes the row a
     containing block for `position: fixed` and centres the sheet in the row
     instead of the viewport. */
  const mounted = useMounted();
  if (!mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-[3001] flex items-center justify-center">
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 cursor-default bg-black/[0.68]"
      />
      <div
        role="dialog"
        aria-modal="true"
        className={cn(
          "relative max-w-[calc(100vw-2rem)] bg-[#121212] shadow-[0_2px_12px_rgba(0,0,0,0.4)]",
          className,
        )}
      >
        {children}
      </div>
    </div>,
    document.body,
  );
}

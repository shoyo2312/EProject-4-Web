"use client";

import { useRouter } from "next/navigation";
import { useCallback, useRef, useState } from "react";

import { MoreHorizontalIcon } from "@/components/icons";
import { useSession } from "@/components/session/SessionProvider";
import { Modal } from "@/components/ui/modal";
import { toast } from "@/components/ui/toast";
import { useDismiss } from "@/hooks/use-dismiss";
import { isApiError, messageFor } from "@/lib/api/errors";
import { block, getMuted, mute, unmute } from "@/lib/api/users";

// ponytail: whether they are muted is read off the first 100 rows of the
// viewer's muted list — user-service has no per-account check. Past that the
// row says "Mute", and the server's ALREADY_MUTED settles it.
const MUTED_SCAN = 100;

/**
 * The "…" beside Share on someone else's profile: Mute and Block, which
 * user-service keeps independent of each other. Block asks first — it also
 * ends the follows both ways — and then leaves the page, since from then on
 * this profile answers 404 to the viewer.
 */
export function ProfileMoreMenu({ userId, name }: { userId: string; name: string }) {
  const router = useRouter();
  const { requireSignIn } = useSession();
  const [open, setOpen] = useState(false);
  /** Null until the muted list has been read. */
  const [muted, setMuted] = useState<boolean | null>(null);
  const [confirmingBlock, setConfirmingBlock] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const close = useCallback(() => setOpen(false), []);
  useDismiss(rootRef, open, close);

  const toggleMenu = () => {
    if (!requireSignIn()) return;
    if (!open && muted === null) {
      getMuted(0, MUTED_SCAN).then(
        (page) => setMuted(page.content.some((row) => row.userId === userId)),
        () => setMuted(false),
      );
    }
    setOpen((was) => !was);
  };

  const toggleMute = () => {
    setOpen(false);
    const next = !muted;
    setMuted(next);
    (next ? mute(userId) : unmute(userId)).then(
      () => toast.success(next ? `Muted ${name}.` : `Unmuted ${name}.`),
      (cause: unknown) => {
        // Already where the tap meant to go — done on another device.
        if (isApiError(cause) && cause.is(next ? "ALREADY_MUTED" : "NOT_MUTED")) return;
        setMuted(!next);
        toast.error(messageFor(cause));
      },
    );
  };

  const confirmBlock = () => {
    setConfirmingBlock(false);
    block(userId).then(
      () => {
        toast.success(`Blocked ${name}. Unblock them in Settings › Privacy.`);
        router.replace("/");
      },
      (cause: unknown) => {
        if (isApiError(cause) && cause.is("ALREADY_BLOCKED")) {
          router.replace("/");
          return;
        }
        toast.error(messageFor(cause));
      },
    );
  };

  return (
    <div ref={rootRef} className="relative flex-none">
      <button
        type="button"
        onClick={toggleMenu}
        aria-label="More"
        title="More"
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex h-11 w-11 items-center justify-center rounded-full bg-[var(--tt-field)] text-[var(--tt-icon)] transition-colors hover:bg-[var(--tt-shape-neutral-3)]"
      >
        <MoreHorizontalIcon className="h-5 w-5" />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute top-12 right-0 z-[101] w-44 overflow-hidden rounded-[8px] bg-[#252525] shadow-[0_2px_12px_rgba(0,0,0,0.4)]"
        >
          <button
            type="button"
            role="menuitem"
            onClick={toggleMute}
            disabled={muted === null}
            className="flex w-full px-4 py-3 text-left text-[15px] text-[var(--tt-text)] hover:bg-white/10 disabled:opacity-50"
          >
            {muted ? "Unmute" : "Mute"}
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              setConfirmingBlock(true);
            }}
            className="flex w-full px-4 py-3 text-left text-[15px] text-[var(--tt-red)] hover:bg-white/10"
          >
            Block
          </button>
        </div>
      )}

      {confirmingBlock && (
        <Modal onClose={() => setConfirmingBlock(false)}>
          <h2 className="text-center text-[18px] font-bold text-[var(--tt-text)]">Block {name}?</h2>
          <p className="mt-2 text-center text-[14px] leading-5 text-[var(--tt-text-secondary)]">
            They won’t be able to find your profile or videos, and you’ll stop following each
            other. Unblocking later won’t bring the follows back.
          </p>
          <div className="mt-6 flex flex-col gap-2">
            <button
              type="button"
              onClick={confirmBlock}
              className="h-11 rounded-[8px] bg-[var(--tt-red)] text-[15px] font-semibold text-white transition-colors hover:bg-[var(--tt-red-hover)]"
            >
              Block
            </button>
            <button
              type="button"
              onClick={() => setConfirmingBlock(false)}
              className="h-11 rounded-[8px] border border-[var(--tt-divider)] text-[15px] font-semibold text-[var(--tt-text)] transition-colors hover:bg-[var(--tt-field)]"
            >
              Cancel
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

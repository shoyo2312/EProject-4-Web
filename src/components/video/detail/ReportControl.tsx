"use client";

import { useCallback, useRef, useState } from "react";

import { MoreIcon, ReportIcon } from "@/components/icons";
import { ReportDialog } from "@/components/report/ReportDialog";
import { useSession } from "@/components/session/SessionProvider";
import { useDismiss } from "@/hooks/use-dismiss";
import { VIDEO_REPORT_REASONS } from "@/lib/api/reports";

/**
 * Report, for a viewer who is not the owner: pick a reason from the list, read
 * back what that reason covers, then submit. The second step is the point —
 * it is the only chance to bounce a mistaken report before it reaches a
 * moderator's queue.
 */
export function ReportControl({ videoId }: { videoId: string }) {
  const { user, openLogin } = useSession();
  const [menuOpen, setMenuOpen] = useState(false);
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  // Click-outside / Escape dismiss, as every other popover on this page does.
  const closeMenu = useCallback(() => setMenuOpen(false), []);
  useDismiss(rootRef, menuOpen, closeMenu);

  return (
    <div ref={rootRef} className="relative flex-none">
      <button
        type="button"
        onClick={() => setMenuOpen((o) => !o)}
        aria-label="More"
        aria-haspopup="menu"
        aria-expanded={menuOpen}
        className="flex h-8 w-8 items-center justify-center rounded-full text-[var(--tt-icon)] transition-colors hover:bg-[var(--tt-field)]"
      >
        <MoreIcon className="h-5 w-5" />
      </button>

      {/* The live bar's "…" menu: icon + label rows over a dark sheet. Ours has
          the one row the clone can act on. */}
      {menuOpen && (
        <div
          role="menu"
          className="absolute right-0 bottom-11 z-[101] w-36 overflow-hidden rounded-[8px] bg-[#252525] shadow-[0_2px_12px_rgba(0,0,0,0.4)]"
        >
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setMenuOpen(false);
              if (!user) {
                openLogin();
                return;
              }
              setOpen(true);
            }}
            className="flex w-full items-center gap-3 px-6 py-3 text-left text-[var(--tt-text)] hover:bg-white/10"
          >
            <ReportIcon className="h-5 w-5 flex-none" />
            Report
          </button>
        </div>
      )}

      {open && (
        <ReportDialog
          targetType="VIDEO"
          targetId={videoId}
          reasons={VIDEO_REPORT_REASONS}
          onClose={() => setOpen(false)}
        />
      )}
    </div>
  );
}

"use client";

import { Keyboard, LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { CloseIcon, SettingsIcon } from "@/components/icons";
import { useSession } from "@/components/session/SessionProvider";
import { Modal } from "@/components/ui/modal";
import { useEscapeKey } from "@/hooks/use-escape-key";
import { KEYBOARD_SHORTCUTS } from "@/lib/site-config";
import { cn } from "@/lib/utils";

/**
 * The sidebar's More panel, in the slot beside the rail that Activity and
 * Search use. TikTok's carries creator tools, language and theme rows the
 * clone has nothing behind; this one holds what it does: Settings, the
 * keyboard shortcuts, and Log out.
 */
export function MoreDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const { user, confirmSignOut } = useSession();
  const [shortcutsOpen, setShortcutsOpen] = useState(false);

  useEscapeKey(onClose, open && !shortcutsOpen);

  return (
    <div
      inert={!open || undefined}
      className={cn(
        // The same panel as `ActivityDrawer` — see there for the measurements.
        "fixed top-0 z-[1] h-screen w-80 overscroll-contain bg-[var(--tt-page)]",
        "left-18 border-x border-[var(--tt-divider)]",
        "transition-[transform,opacity,visibility] duration-[400ms] ease-[ease]",
        open
          ? "visible opacity-100 [transform:translateX(0)]"
          : "invisible opacity-30 [transform:translateX(-24rem)] [pointer-events:none]",
      )}
    >
      <div className="absolute end-4 top-6 z-[1] flex items-center justify-center">
        <button
          type="button"
          onClick={onClose}
          aria-label="Close more"
          className="flex h-7 w-7 items-center justify-center rounded-full bg-[var(--tt-field)] text-[var(--tt-icon)] transition-colors hover:bg-[var(--tt-shape-neutral-3)]"
        >
          <CloseIcon className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="flex h-full flex-col gap-4 px-2 pt-5">
        <h2 className="px-2 text-[20px] font-semibold leading-[25px] text-[var(--tt-text)]">
          More
        </h2>

        <nav className="flex flex-col">
          <Row
            icon={<SettingsIcon className="h-6 w-6" />}
            label="Settings"
            onClick={() => {
              onClose();
              router.push("/setting");
            }}
          />
          <Row
            icon={<Keyboard className="h-6 w-6" strokeWidth={1.75} />}
            label="Keyboard shortcuts"
            onClick={() => setShortcutsOpen(true)}
          />
          {user && (
            <Row
              icon={<LogOut className="h-6 w-6" strokeWidth={1.75} />}
              label="Log out"
              onClick={() => {
                onClose();
                confirmSignOut();
              }}
            />
          )}
        </nav>
      </div>

      {shortcutsOpen && (
        <Modal onClose={() => setShortcutsOpen(false)} className="w-[400px] rounded-[12px] p-6">
          <h2 className="mb-4 text-center text-[20px] font-bold text-[var(--tt-text)]">
            Keyboard shortcuts
          </h2>
          <dl className="flex flex-col gap-3">
            {KEYBOARD_SHORTCUTS.map(({ keys, action }) => (
              <div key={action} className="flex items-center justify-between gap-4">
                <dt className="text-[15px] text-[var(--tt-text)]">{action}</dt>
                <dd className="flex gap-1">
                  {keys.map((key) => (
                    <kbd
                      key={key}
                      className="min-w-7 rounded-[4px] bg-[var(--tt-field)] px-2 py-0.5 text-center font-sans text-[13px] font-semibold text-[var(--tt-text)]"
                    >
                      {key}
                    </kbd>
                  ))}
                </dd>
              </div>
            ))}
          </dl>
        </Modal>
      )}
    </div>
  );
}

function Row({
  icon,
  label,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex h-12 items-center gap-3 rounded-[6px] px-2 text-left text-[16px] font-medium text-[var(--tt-text)] transition-colors hover:bg-[var(--tt-field)]"
    >
      <span className="flex h-8 w-8 flex-none items-center justify-center text-[var(--tt-icon)]">
        {icon}
      </span>
      {label}
    </button>
  );
}

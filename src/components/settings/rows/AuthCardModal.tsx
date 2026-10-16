"use client";

import { ChevronLeftIcon, CloseIcon } from "@/components/icons";
import { Modal } from "@/components/ui/modal";

/**
 * The login modal's card, for the Settings flows built from its steps (set a
 * password, add an email). `stepKey` remounts the step on every change, as the
 * login modal does, so a step stepped back to starts fresh.
 */
export function AuthCardModal({
  stepKey,
  onBack,
  onClose,
  children,
}: {
  stepKey: string;
  /** Shown as the back chevron when given. */
  onBack?: () => void;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <Modal
      onClose={onClose}
      className="flex h-[562px] max-h-full w-[428px] flex-col overflow-hidden rounded-[24px] bg-[#1e1e1e]"
    >
      <div className="no-scrollbar relative min-h-0 flex-1 overflow-y-auto px-2">
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            aria-label="Back"
            className="absolute top-5 left-4 flex h-[30px] w-6 items-start text-[var(--tt-text)]"
          >
            <ChevronLeftIcon className="h-6 w-6" />
          </button>
        )}

        <div key={stepKey} className="mx-8">
          {children}
        </div>
      </div>

      <button
        type="button"
        onClick={onClose}
        aria-label="Close"
        className="absolute top-[17px] right-[18px] z-10 flex h-8 w-8 items-center justify-center rounded-full bg-white/[0.04] text-[var(--tt-text)] transition-colors hover:bg-white/10"
      >
        <CloseIcon className="h-5 w-5" />
      </button>
    </Modal>
  );
}

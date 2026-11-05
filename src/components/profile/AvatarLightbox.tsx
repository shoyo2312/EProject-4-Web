"use client";

import { createPortal } from "react-dom";

import { CloseIcon } from "@/components/icons";
import { modalCardMotion, modalOverlayMotion } from "@/components/ui/modal";
import { useEscapeKey } from "@/hooks/use-escape-key";
import { useMounted } from "@/hooks/use-mounted";
import { cn } from "@/lib/utils";

/**
 * The avatar at full size over a dark mask, with the house modal motion. Stays mounted for
 * `MODAL_EXIT_MS` after `closing` turns true so the fade and shrink can run.
 */
export function AvatarLightbox({
  src,
  name,
  closing,
  onClose,
}: {
  src: string;
  name: string;
  closing: boolean;
  onClose: () => void;
}) {
  useEscapeKey(onClose, !closing);
  const mounted = useMounted();
  if (!mounted) return null;

  return createPortal(
    <div
      inert={closing || undefined}
      role="dialog"
      aria-modal="true"
      aria-label={`${name}'s avatar`}
      className={cn(
        "fixed inset-0 z-[3001] flex items-center justify-center",
        modalOverlayMotion(closing),
      )}
    >
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 cursor-default bg-black/[0.85]"
      />
      <div className={cn("relative h-[min(80vw,480px)] w-[min(80vw,480px)]", modalCardMotion(closing))}>
        {/* eslint-disable-next-line @next/next/no-img-element -- avatar URL comes from user-service, not the image pipeline */}
        <img
          src={src}
          alt={`${name}'s avatar`}
          referrerPolicy="no-referrer"
          className="h-full w-full rounded-full object-cover shadow-[0_8px_40px_rgba(0,0,0,0.6)]"
        />
        {/* Beside the picture, not the viewport corner: the header's own avatar sits up there. */}
        <button
          type="button"
          aria-label="Close"
          onClick={onClose}
          className="absolute top-[7%] right-[7%] flex h-10 w-10 translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white/15 text-white backdrop-blur-sm transition-colors hover:bg-white/30"
        >
          <CloseIcon className="h-5 w-5" />
        </button>
      </div>
    </div>,
    document.body,
  );
}

"use client";

import { useRef } from "react";
import { createPortal } from "react-dom";

import { CloseIcon } from "@/components/icons";
import { useEscapeKey } from "@/hooks/use-escape-key";
import { useFocusTrap } from "@/hooks/use-focus-trap";
import { useMounted } from "@/hooks/use-mounted";

/**
 * The picture at full size over the page. Escape, the cross and a press on the dark area all close it;
 * focus stays inside while it is open. Rendered into <body> for the same reason `Modal` is.
 */
export function ImageLightbox({ src, onClose }: { src: string; onClose: () => void }) {
  useEscapeKey(onClose);
  const mounted = useMounted();
  const dialog = useRef<HTMLDivElement>(null);
  useFocusTrap(dialog, mounted);
  if (!mounted) return null;

  return createPortal(
    <div
      ref={dialog}
      role="dialog"
      aria-modal="true"
      aria-label="Photo"
      tabIndex={-1}
      className="fixed inset-0 z-[3002] flex items-center justify-center bg-black/90 p-4 motion-safe:animate-in motion-safe:fade-in motion-safe:duration-200"
      onClick={onClose}
    >
      <button
        type="button"
        onClick={onClose}
        aria-label="Close photo"
        autoFocus
        className="absolute top-[max(1rem,env(safe-area-inset-top))] right-4 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20 focus-visible:outline-2 focus-visible:outline-white"
      >
        <CloseIcon className="h-5 w-5" />
      </button>
      {/* eslint-disable-next-line @next/next/no-img-element -- an object URL made from an authenticated fetch; next/image cannot load it */}
      <img
        src={src}
        alt="Photo"
        draggable={false}
        onClick={(event) => event.stopPropagation()}
        className="max-h-full max-w-full rounded-[8px] object-contain"
      />
    </div>,
    document.body,
  );
}

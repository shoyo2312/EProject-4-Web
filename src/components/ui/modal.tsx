"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

import { cn } from "@/lib/utils";

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
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  /* Rendered into <body>: callers mount this deep inside rows that carry
     `content-visibility: auto` (paint containment), which makes the row a
     containing block for `position: fixed` and centres the sheet in the row
     instead of the viewport. */
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
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

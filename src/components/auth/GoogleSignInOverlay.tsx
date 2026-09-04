"use client";

import { useEffect, useRef } from "react";

/**
 * Google's own "Continue with Google" button, rendered transparent and laid
 * over the styled row it sits on. The row underneath is what the viewer sees;
 * the click lands on Google's element, which is the only thing allowed to open
 * the account-chooser popup. `mount` returns its own cleanup.
 */
export function GoogleSignInOverlay({
  mount,
}: {
  mount: (el: HTMLElement) => () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ref.current) return;
    return mount(ref.current);
  }, [mount]);

  return (
    <div
      ref={ref}
      aria-hidden="true"
      className="absolute inset-0 z-10 flex items-center justify-center overflow-hidden opacity-0"
    />
  );
}

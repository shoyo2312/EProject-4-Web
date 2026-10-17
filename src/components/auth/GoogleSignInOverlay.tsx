"use client";

import { useEffect, useRef } from "react";

/**
 * Google's own "Continue with Google" button, laid over the row it replaces.
 * It has to be visible: Google drops clicks on a transparent button (its
 * clickjacking guard), so an `opacity-0` overlay opened nothing. Google's
 * element is the only thing allowed to open the account-chooser popup.
 * `mount` returns its own cleanup.
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
      className="absolute inset-0 z-10 flex items-center justify-center overflow-hidden"
    />
  );
}

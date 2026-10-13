"use client";

import { useEffect, useRef } from "react";

import { removeTurnstile, renderTurnstile } from "@/lib/auth/turnstile";
import { cn } from "@/lib/utils";

/**
 * Solving it hands the token up via `onVerify`, and the caller attaches it to
 * the request that mails a code. A token is single-use, so every send that
 * needs one mounts a fresh widget.
 */
export function TurnstileWidget({
  onVerify,
  className,
}: {
  onVerify: (token: string) => void;
  /** Replaces the default vertical margin — the modal places it in a fixed gap. */
  className?: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let widgetId: string | undefined;
    let cancelled = false;

    renderTurnstile(
      container,
      {
        onToken: onVerify,
        // A widget that errors or expires stops being a valid token; the
        // submit button re-disables itself since `onVerify` is not called again.
        onError: () => undefined,
      },
      () => cancelled,
    ).then((id) => {
      widgetId = id;
    });

    return () => {
      cancelled = true;
      if (widgetId) removeTurnstile(widgetId);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <div ref={containerRef} className={cn("my-4", className)} />;
}

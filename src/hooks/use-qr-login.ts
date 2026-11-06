"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { createQrLogin, pollQrLogin } from "@/lib/api/auth";
import { messageFor } from "@/lib/api/errors";
import { hasLapsed, nextQrView, QR_POLL_INTERVAL_MS, type QrView } from "@/lib/auth/qr-login";

/**
 * Runs one QR sign-in: asks for a code, then polls it every two seconds until
 * the phone approves or rejects it, or it runs out. Polling pauses while the
 * tab is hidden and stops when the step unmounts. `refresh` starts over with a
 * new code.
 *
 * `onApproved` runs once the session is stored — even if the step closed in
 * the last poll's flight, since the tokens are already in the browser by then.
 */
export function useQrLogin(onApproved: () => Promise<void>) {
  const [view, setView] = useState<QrView>({ phase: "loading" });
  const [attempt, setAttempt] = useState(0);
  const viewRef = useRef(view);
  useEffect(() => {
    viewRef.current = view;
  }, [view]);
  const onApprovedRef = useRef(onApproved);
  useEffect(() => {
    onApprovedRef.current = onApproved;
  });

  const refresh = useCallback(() => {
    setView({ phase: "loading" });
    setAttempt((n) => n + 1);
  }, []);

  useEffect(() => {
    let cancelled = false;
    createQrLogin().then(
      (code) => {
        if (!cancelled) setView({ phase: "showing", code, scannedBy: null });
      },
      (cause: unknown) => {
        if (!cancelled) setView({ phase: "error", message: messageFor(cause) });
      },
    );
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  const code = view.phase === "showing" ? view.code : null;

  useEffect(() => {
    if (!code) return;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const schedule = () => {
      if (!stopped) timer = setTimeout(tick, QR_POLL_INTERVAL_MS);
    };

    const tick = async () => {
      if (hasLapsed(viewRef.current, Date.now())) {
        setView({ phase: "expired" });
        return;
      }
      if (document.visibilityState === "hidden") {
        schedule();
        return;
      }
      try {
        const answer = await pollQrLogin(code.qrId, code.pollToken);
        if (answer.status === "APPROVED" && answer.tokens) {
          if (!stopped) setView({ phase: "approved" });
          await onApprovedRef.current();
          return;
        }
        if (stopped) return;
        setView((current) => nextQrView(current, answer));
        if (answer.status === "REJECTED" || answer.status === "EXPIRED") return;
      } catch {
        // A dropped poll is not a failed sign-in: the code is still live, so
        // ask again on the next tick.
      }
      schedule();
    };

    schedule();
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, [code]);

  return { view, refresh };
}

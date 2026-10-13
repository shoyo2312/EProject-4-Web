"use client";

import { useCallback, useState } from "react";

/**
 * A Cloudflare Turnstile token for a form that always requires one — the first
 * send of a code (startSignup, addEmail, resendVerification, forgotPassword) is
 * gated on the backend, not just suspicious ones, and only a resend can go on
 * a ticket instead (see auth-service `OtpSendGate`).
 *
 * A solved token is single-use and expires ~5 minutes after solving, so it has
 * to be thrown away after every submit attempt — success or failure — and a
 * fresh widget mounted for the next one. `widgetKey` is that fresh mount:
 * bump it and hand it to `<TurnstileWidget key={widgetKey} .../>`.
 */
export function useTurnstileToken() {
  const [token, setToken] = useState<string | null>(null);
  const [widgetKey, setWidgetKey] = useState(0);

  const consume = useCallback(() => {
    setToken(null);
    setWidgetKey((key) => key + 1);
  }, []);

  return { token, setToken, consume, widgetKey };
}

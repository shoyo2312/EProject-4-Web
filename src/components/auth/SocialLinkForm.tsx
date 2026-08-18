"use client";

import { useState } from "react";

import { AuthSubmit, AuthTitle, FormNotice } from "@/components/auth/AuthFields";
import type { SocialLinkChallenge } from "@/components/auth/use-social-sign-in";

/**
 * The step between "signed in with Facebook" and "signed in", shown when that
 * Facebook account's address already belongs to an account here.
 *
 * Deliberately says nothing about the account it would merge into — not its
 * username, not the address itself. Whoever owns the account already knows
 * both; to anyone else, printing them would confirm a stranger has an account
 * here.
 *
 * Rendered in place of the option list rather than as a route: the provider
 * token lives in memory for exactly this step, and a URL it could survive in is
 * the one thing this flow must not have.
 */
export function SocialLinkForm({
  challenge,
  onConfirm,
  onCancel,
  error,
  busy = false,
  compact = false,
}: {
  challenge: SocialLinkChallenge;
  onConfirm: (otp: string) => void;
  onCancel: () => void;
  error?: string | null;
  busy?: boolean;
  /** The modal's narrower column, which has no room for the page's spacing. */
  compact?: boolean;
}) {
  const [otp, setOtp] = useState("");
  const provider = challenge.provider === "google" ? "Google" : "Facebook";

  return (
    <form
      className={compact ? "mx-auto w-[300px] max-w-full text-left" : "text-left"}
      onSubmit={(event) => {
        event.preventDefault();
        if (otp.length === 6) onConfirm(otp);
      }}
      noValidate
    >
      <AuthTitle>Confirm it&rsquo;s you</AuthTitle>

      <p className="mt-2 mb-5 text-[14px] leading-5 text-[var(--tt-text-secondary)]">
        That {provider} account uses an email address that already has an
        account here. We emailed a 6-digit code to it — enter it to log in and
        connect {provider} to that account.
      </p>

      <input
        value={otp}
        onChange={(event) =>
          setOtp(event.target.value.replace(/\D/g, "").slice(0, 6))
        }
        inputMode="numeric"
        autoComplete="one-time-code"
        aria-label="Verification code"
        placeholder="Enter 6-digit code"
        className="mb-3 h-11 w-full rounded-[2px] bg-[var(--tt-field)] px-3 text-[16px] tracking-[0.3em] text-[var(--tt-text)] placeholder:tracking-normal placeholder:text-[var(--tt-text-muted)]"
      />

      {error && <FormNotice error>{error}</FormNotice>}

      <AuthSubmit disabled={otp.length !== 6 || busy}>
        {busy ? "Confirming…" : "Confirm and log in"}
      </AuthSubmit>

      <button
        type="button"
        onClick={onCancel}
        className="mt-3 w-full text-center text-[14px] leading-5 text-[var(--tt-text-secondary)] hover:underline"
      >
        Use another way to log in
      </button>
    </form>
  );
}

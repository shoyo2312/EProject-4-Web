"use client";

import { useEffect, useRef, useState } from "react";

import type { SocialLinkChallenge } from "@/components/auth/use-social-sign-in";
import { CODE_LENGTH, emptyCode } from "@/lib/forms/code-digits";

import { CodeBoxes } from "./CodeBoxes";
import { ModalTitle, PillButton } from "./ModalFields";

/**
 * The step between "signed in with Facebook" and signed in, shown when that
 * Facebook account's address already belongs to an account here — or when the
 * Facebook account was linked before that account's address was proven, and
 * whoever now owns the mailbox has to vouch for the link.
 *
 * The code goes to the account's address, which in the second case need not be
 * Facebook's (Facebook may not share one at all), so the copy says "the address
 * on your account", never the provider's.
 *
 * Deliberately says nothing about the account it would merge into — not its
 * username, not the address itself. Whoever owns the account already knows
 * both; to anyone else, printing them would confirm a stranger has an account
 * here.
 *
 * Shown in place of the option list, never behind a URL: the provider token
 * lives in memory for exactly this step, and a URL it could survive in is the
 * one thing this flow must not have.
 */
export function SocialLinkStep({
  challenge,
  busy,
  onConfirm,
  onCancel,
}: {
  challenge: SocialLinkChallenge;
  busy: boolean;
  /** A wrong code is toasted and keeps the step up, so it can be corrected. */
  onConfirm: (otp: string) => void;
  onCancel: () => void;
}) {
  const [digits, setDigits] = useState(emptyCode);
  const firstBox = useRef<HTMLInputElement>(null);
  const code = digits.join("");
  const provider = challenge.provider === "google" ? "Google" : "Facebook";

  useEffect(() => firstBox.current?.focus(), []);

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        if (code.length === CODE_LENGTH) onConfirm(code);
      }}
      noValidate
    >
      <ModalTitle className="mb-4">Confirm it&rsquo;s you</ModalTitle>

      <p className="mb-10 text-center text-[14px] leading-5 text-[var(--tt-text-muted)]">
        We emailed a 6-digit code to the address on your account here. Enter it
        to log in with {provider}.
      </p>

      <div className="flex justify-center">
        <CodeBoxes digits={digits} onChange={setDigits} disabled={busy} firstRef={firstBox} />
      </div>

      <PillButton disabled={code.length !== CODE_LENGTH || busy} className="mt-12 mb-4">
        {busy ? "Confirming…" : "Confirm and log in"}
      </PillButton>

      <button
        type="button"
        onClick={onCancel}
        className="mx-auto block text-[14px] leading-[18.2px] font-semibold text-[var(--tt-text-muted)] hover:underline"
      >
        Use another way to log in
      </button>
    </form>
  );
}

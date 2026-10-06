"use client";

import { useEffect, useRef, useState } from "react";

import { TurnstileWidget } from "@/components/auth/TurnstileWidget";
import { toast } from "@/components/ui/toast";
import { isApiError, messageFor } from "@/lib/api/errors";
import { maskEmail } from "@/lib/auth/mask-email";
import { CODE_LENGTH, emptyCode } from "@/lib/forms/code-digits";

import { CodeBoxes, ModalTitle } from "./ModalFields";

const RESEND_COOLDOWN = 60;

/**
 * "Enter 6-digit code" — the step every mailed code passes through: signup,
 * password reset, and confirming an address. The code is checked the moment
 * the sixth box is filled, with no button, exactly as the live modal does.
 *
 * Every resend is gated on Turnstile server-side, but the live screen has no
 * widget on it, so one is mounted only once "Resend code" is pressed and the
 * resend goes out by itself when it is solved.
 *
 * Measured live: column padding 72px 40px, the caption 13/16.9 at .5 with 8px
 * under it, the boxes with 24px under them, then "Resend code" 15/22.5/600 in
 * #FF3B5C.
 */
export function CodeStep({
  email,
  onSubmit,
  onResend,
}: {
  email: string;
  /**
   * Spends the code. Whatever it throws is toasted and the boxes empty for a
   * retry; `INVALID_OTP`, a wrong or expired code, also marks them red.
   */
  onSubmit: (code: string) => Promise<void>;
  /** Mails a fresh code. */
  onResend: (turnstileToken: string) => Promise<void>;
}) {
  const [digits, setDigits] = useState(emptyCode);
  const [busy, setBusy] = useState(false);
  const [invalid, setInvalid] = useState(false);
  const [wantsResend, setWantsResend] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const firstBox = useRef<HTMLInputElement>(null);

  useEffect(() => firstBox.current?.focus(), []);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = window.setTimeout(() => setCooldown((left) => left - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [cooldown]);

  const submit = async (code: string) => {
    setBusy(true);
    try {
      await onSubmit(code);
      return;
    } catch (cause) {
      toast.error(messageFor(cause));
      setInvalid(isApiError(cause) && cause.is("INVALID_OTP"));
    } finally {
      setBusy(false);
    }
    setDigits(emptyCode());
    requestAnimationFrame(() => firstBox.current?.focus());
  };

  const change = (next: string[]) => {
    setDigits(next);
    setInvalid(false);
    if (next.join("").length === CODE_LENGTH) void submit(next.join(""));
  };

  const resend = async (token: string) => {
    setWantsResend(false);
    try {
      await onResend(token);
      // Issuing a code deletes the previous one, so a code already in the
      // inbox is dead — say so before it is typed.
      toast.success("A new code is on its way — the previous one stops working.");
      setCooldown(RESEND_COOLDOWN);
      setDigits(emptyCode());
      firstBox.current?.focus();
    } catch (cause) {
      toast.error(messageFor(cause));
    }
  };

  return (
    <>
      <ModalTitle className="mb-8">Enter 6-digit code</ModalTitle>

      <div className="flex flex-col items-center px-10 py-[72px]">
        <div className="flex flex-col items-start">
          <p className="mb-2 text-[13px] leading-[16.9px] text-[var(--tt-text-muted)]">
            Your code was sent to {maskEmail(email)}
          </p>
          <div className="mb-6">
            <CodeBoxes
              digits={digits}
              onChange={change}
              disabled={busy}
              invalid={invalid}
              firstRef={firstBox}
            />
          </div>
        </div>

        <div className="mb-6 flex items-center gap-1">
          <button
            type="button"
            disabled={cooldown > 0 || wantsResend}
            onClick={() => setWantsResend(true)}
            className="py-2 text-[15px] leading-[22.5px] font-semibold text-[var(--tt-red-active)] disabled:cursor-not-allowed disabled:text-[rgb(255_255_255/0.34)]"
          >
            Resend code
          </button>
          {cooldown > 0 && (
            <span className="text-[15px] leading-[22.5px] text-[rgb(255_255_255/0.34)]">
              ({cooldown}s)
            </span>
          )}
        </div>

        {wantsResend && <TurnstileWidget onVerify={resend} className="my-0" />}
      </div>
    </>
  );
}

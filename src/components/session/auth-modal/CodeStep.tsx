"use client";

import { useEffect, useRef, useState } from "react";

import { TurnstileWidget } from "@/components/auth/TurnstileWidget";
import { toast } from "@/components/ui/toast";
import type { SendProof } from "@/lib/api/auth";
import { isApiError, messageFor } from "@/lib/api/errors";
import type { OtpSentResponse } from "@/lib/api/types";
import { maskEmail } from "@/lib/auth/mask-email";
import { CODE_LENGTH, emptyCode } from "@/lib/forms/code-digits";

import { CodeBoxes } from "./CodeBoxes";
import { ModalTitle } from "./ModalFields";

const RESEND_COOLDOWN = 60;

/**
 * "Enter 6-digit code" — the step every mailed code passes through: signup,
 * password reset, and confirming an address. The code is checked the moment
 * the sixth box is filled, with no button, exactly as the live modal does.
 *
 * A resend carries the ticket the previous send answered with, so it needs no
 * Turnstile check and the screen has no widget on it, as live. One is mounted
 * only when there is no ticket (the verify step starts without one) or the
 * server refuses it, 15 minutes on, and the resend goes out by itself once it
 * is solved.
 *
 * Measured live: column padding 72px 40px, the caption 13/16.9 at .5 with 8px
 * under it, the boxes with 24px under them, then "Resend code" 15/22.5/600 in
 * #FF3B5C.
 */
export function CodeStep({
  email,
  resendTicket = null,
  onSubmit,
  onResend,
}: {
  email: string;
  /** From the send that led here; null when it answered none. */
  resendTicket?: string | null;
  /**
   * Spends the code. Whatever it throws is toasted and the boxes empty for a
   * retry; `INVALID_OTP`, a wrong or expired code, also marks them red.
   */
  onSubmit: (code: string) => Promise<void>;
  /** Mails a fresh code. */
  onResend: (proof: SendProof) => Promise<OtpSentResponse>;
}) {
  const [digits, setDigits] = useState(emptyCode);
  const [busy, setBusy] = useState(false);
  const [invalid, setInvalid] = useState(false);
  const [ticket, setTicket] = useState(resendTicket);
  const [resending, setResending] = useState(false);
  const [needsTurnstile, setNeedsTurnstile] = useState(false);
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

  const resend = async (proof: SendProof) => {
    setNeedsTurnstile(false);
    setResending(true);
    try {
      const sent = await onResend(proof);
      setTicket(sent.resendTicket);
      // Issuing a code deletes the previous one, so a code already in the
      // inbox is dead — say so before it is typed.
      toast.success("A new code is on its way — the previous one stops working.");
      setCooldown(RESEND_COOLDOWN);
      setDigits(emptyCode());
      firstBox.current?.focus();
    } catch (cause) {
      // The ticket ran out or the server lost it: the check it stood in for is due.
      if ("resendTicket" in proof && isApiError(cause) && cause.is("TURNSTILE_VERIFICATION_FAILED")) {
        setTicket(null);
        setNeedsTurnstile(true);
        return;
      }
      toast.error(messageFor(cause));
    } finally {
      setResending(false);
    }
  };

  const requestResend = () => {
    if (ticket) void resend({ resendTicket: ticket });
    else setNeedsTurnstile(true);
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
            disabled={cooldown > 0 || resending || needsTurnstile}
            onClick={requestResend}
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

        {needsTurnstile && (
          <TurnstileWidget
            onVerify={(token) => resend({ turnstileToken: token })}
            className="my-0"
          />
        )}
      </div>
    </>
  );
}

"use client";

import { useState } from "react";

import { TurnstileWidget } from "@/components/auth/TurnstileWidget";
import { CodeStep } from "@/components/session/auth-modal/CodeStep";
import { NewPasswordStep } from "@/components/session/auth-modal/LoginSteps";
import { ModalTitle, PillButton } from "@/components/session/auth-modal/ModalFields";
import { useSession } from "@/components/session/SessionProvider";
import { AuthCardModal } from "@/components/settings/rows/AuthCardModal";
import { Accessory, ROW_CLASS, RowBody } from "@/components/settings/rows/parts";
import { toast } from "@/components/ui/toast";
import {
  completePasswordReset,
  forgotPassword,
  verifyPasswordReset,
} from "@/lib/api/auth";
import { isApiError, messageFor } from "@/lib/api/errors";
import { maskEmail } from "@/lib/auth/mask-email";
import { useTurnstileToken } from "@/lib/auth/use-turnstile-token";
import { cn } from "@/lib/utils";
import type { SettingsRow } from "@/types/tiktok";

/** What the row says to a social account that has never had a password. */
const SET_PASSWORD_COPY = {
  title: "Set password",
  description:
    "Log in with your email or username and a password, not only with Google or Facebook.",
};

/**
 * Manage account → Change password, or Set password for a social account that
 * has none: one flow either way, since both are a code to the account's own
 * address and then a new password. Signed out, it reads as the common case.
 * Without an address there is nowhere to mail the code to, so the row says so
 * instead of opening.
 */
export function PasswordRow({ row }: { row: SettingsRow }) {
  const { user, requireSignIn } = useSession();
  const [open, setOpen] = useState(false);

  const changing = user?.hasPassword ?? true;
  const shown = changing ? row : { ...row, ...SET_PASSWORD_COPY };
  const email = user?.email ?? null;
  const noEmail = user !== null && email === null;

  return (
    <>
      <button
        type="button"
        disabled={noEmail}
        onClick={() => {
          if (requireSignIn() && email) setOpen(true);
        }}
        className={cn(ROW_CLASS, "hover:bg-white/[0.03] disabled:cursor-not-allowed disabled:hover:bg-transparent")}
      >
        <RowBody
          row={shown}
          note={noEmail ? "Add an email address to your account first." : undefined}
        />
        {!noEmail && <Accessory row={shown} />}
      </button>
      {open && email && (
        <PasswordModal email={email} changing={changing} onClose={() => setOpen(false)} />
      )}
    </>
  );
}

type Step =
  | { name: "send" }
  | { name: "code"; resendTicket: string | null }
  | { name: "password"; resetToken: string };

/**
 * The password-reset flow, started from a signed-in account: a code to the
 * account's own address proves the mailbox, so a stolen session alone cannot
 * plant or replace a password. The current password is not asked for — the
 * code already proves more than it would. The new one ends every session,
 * this one included, so it signs straight back in with it.
 */
function PasswordModal({
  email,
  changing,
  onClose,
}: {
  email: string;
  changing: boolean;
  onClose: () => void;
}) {
  const { signIn, signOut } = useSession();
  const [step, setStep] = useState<Step>({ name: "send" });
  const title = changing ? "Change password" : "Set password";

  const finish = async (password: string) => {
    if (step.name !== "password") return;
    try {
      await completePasswordReset({ resetToken: step.resetToken, newPassword: password });
    } catch (cause) {
      if (isApiError(cause) && cause.is("RESET_SESSION_EXPIRED")) {
        toast.error(messageFor(cause));
        setStep({ name: "send" });
        return;
      }
      throw cause;
    }
    onClose();
    toast.success(changing ? "Password changed." : "Password set.");
    try {
      await signIn(email, password, { quiet: true });
    } catch {
      await signOut();
      toast.error("Log in again with your new password.");
    }
  };

  return (
    <AuthCardModal
      stepKey={step.name}
      // The code is spent once it is checked, so Back only ever leads to a
      // fresh send.
      onBack={step.name === "send" ? undefined : () => setStep({ name: "send" })}
      onClose={onClose}
    >
      {step.name === "send" && (
        <SendCodeStep
          title={title}
          notice={`${changing ? "Changing your" : "Setting a"} password logs you out on your other devices.`}
          email={email}
          onSend={async (token) => {
            const { resendTicket } = await forgotPassword(email, { turnstileToken: token });
            setStep({ name: "code", resendTicket });
          }}
        />
      )}
      {step.name === "code" && (
        <CodeStep
          email={email}
          resendTicket={step.resendTicket}
          onSubmit={async (code) => {
            const { resetToken } = await verifyPasswordReset(email, code);
            setStep({ name: "password", resetToken });
          }}
          onResend={(proof) => forgotPassword(email, proof)}
        />
      )}
      {step.name === "password" && (
        <NewPasswordStep title={title} submitLabel={title} onSubmit={finish} />
      )}
    </AuthCardModal>
  );
}

/** The address is the account's own, so there is no field: only the check and Continue. */
function SendCodeStep({
  title,
  notice,
  email,
  onSend,
}: {
  title: string;
  notice: string;
  email: string;
  onSend: (turnstileToken: string) => Promise<void>;
}) {
  const turnstile = useTurnstileToken();
  const [sending, setSending] = useState(false);

  const send = async () => {
    if (!turnstile.token) return;
    setSending(true);
    try {
      await onSend(turnstile.token);
    } catch (cause) {
      toast.error(messageFor(cause));
      turnstile.consume();
      setSending(false);
    }
  };

  return (
    <>
      <ModalTitle className="mb-8">{title}</ModalTitle>

      <div className="px-4 pt-10 pb-5">
        <p className="text-center text-[15px] leading-[21px] text-[var(--tt-text)]">
          We’ll send a 6-digit code to {maskEmail(email)} to confirm it’s you.
        </p>
        <p className="mt-3 text-center text-[13px] leading-[17px] text-[var(--tt-text-muted)]">
          {notice}
        </p>

        <div className="mt-6 flex min-h-[71px] justify-center">
          <TurnstileWidget
            key={turnstile.widgetKey}
            onVerify={turnstile.setToken}
            className="my-0"
          />
        </div>

        <PillButton
          type="button"
          onClick={send}
          disabled={!turnstile.token || sending}
          className="mt-[33px] mb-4"
        >
          {sending ? "Sending…" : "Continue"}
        </PillButton>
      </div>
    </>
  );
}

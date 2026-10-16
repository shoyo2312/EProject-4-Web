"use client";

import { useState } from "react";

import { AddEmailStep } from "@/components/session/auth-modal/AddEmailStep";
import { CodeStep } from "@/components/session/auth-modal/CodeStep";
import { useSession } from "@/components/session/SessionProvider";
import { AuthCardModal } from "@/components/settings/rows/AuthCardModal";
import { Accessory, ROW_CLASS, RowBody } from "@/components/settings/rows/parts";
import { toast } from "@/components/ui/toast";
import { addEmail, resendVerification, verifyEmail } from "@/lib/api/auth";
import { isApiError, messageFor } from "@/lib/api/errors";
import { cn } from "@/lib/utils";
import type { SettingsRow } from "@/types/tiktok";

/**
 * Manage account → Add email address, for a social account the provider gave
 * none and whose owner skipped the step after login. Only a signed-in account
 * without an address sees it.
 */
export function AddEmailRow({ row }: { row: SettingsRow }) {
  const { user } = useSession();
  const [open, setOpen] = useState(false);

  if (!user || user.email !== null) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(ROW_CLASS, "hover:bg-white/[0.03]")}
      >
        <RowBody row={row} />
        <Accessory row={row} />
      </button>
      {open && <AddEmailModal onClose={() => setOpen(false)} />}
    </>
  );
}

type Step = { name: "email" } | { name: "code"; email: string; resendTicket: string | null };

/**
 * The login modal's add-email steps. `POST /auth/email` stores the address
 * before it is proven, so once it has gone through, closing re-reads `/me`
 * whatever step the modal is on: a session still showing no address would
 * offer this again, and the same address sent twice is refused as taken.
 */
function AddEmailModal({ onClose }: { onClose: () => void }) {
  const { reload } = useSession();
  const [step, setStep] = useState<Step>({ name: "email" });

  const close = () => {
    onClose();
    if (step.name === "code") void reload();
  };

  return (
    <AuthCardModal
      stepKey={step.name}
      onBack={step.name === "code" ? () => setStep({ name: "email" }) : undefined}
      onClose={close}
    >
      {step.name === "email" && (
        <AddEmailStep
          description="Add an email address so you can set a password, and still get in if you lose your Google or Facebook account."
          onSubmit={async (email, token, setFieldError) => {
            try {
              const { resendTicket } = await addEmail(email, token);
              setStep({ name: "code", email, resendTicket });
            } catch (cause) {
              if (isApiError(cause) && cause.is("EMAIL_ALREADY_EXISTS")) {
                setFieldError("email", messageFor(cause));
                return;
              }
              throw cause;
            }
          }}
        />
      )}
      {step.name === "code" && (
        <CodeStep
          email={step.email}
          resendTicket={step.resendTicket}
          onSubmit={async (code) => {
            await verifyEmail({ email: step.email, otp: code });
            toast.success("Email verified.");
            close();
          }}
          onResend={(proof) => resendVerification(step.email, proof)}
        />
      )}
    </AuthCardModal>
  );
}

"use client";

import { useState } from "react";

import { toast } from "@/components/ui/toast";
import { messageFor } from "@/lib/api/errors";

import { ModalTitle, PillButton } from "./ModalFields";

/**
 * A sign-in whose credential was right, to an account its owner deactivated
 * or asked to delete. The account stays closed unless they choose to reopen
 * it here; reopening also cancels a scheduled deletion.
 *
 * Reached only after the server checked the credential, so naming what
 * happened to the account tells nobody anything they could not already open.
 */
export function ReactivateStep({
  deletionPending,
  onReactivate,
  onCancel,
}: {
  deletionPending: boolean;
  /** Signs in again with the same credential and `reactivate`; closes the modal on success. */
  onReactivate: () => Promise<void>;
  onCancel: () => void;
}) {
  const [busy, setBusy] = useState(false);

  const reactivate = async () => {
    setBusy(true);
    try {
      await onReactivate();
    } catch (cause) {
      toast.error(messageFor(cause));
      setBusy(false);
    }
  };

  return (
    <>
      <ModalTitle className="mb-4">Reactivate your account?</ModalTitle>

      <p className="mb-10 text-center text-[14px] leading-5 text-[var(--tt-text-muted)]">
        {deletionPending
          ? "You asked for this account to be deleted. Reactivate it to cancel the deletion and get back your profile, videos and comments."
          : "You deactivated this account. Reactivate it to get back your profile, videos and comments."}
      </p>

      <PillButton type="button" onClick={reactivate} disabled={busy} className="mb-4">
        {busy ? "Reactivating…" : "Reactivate"}
      </PillButton>

      <button
        type="button"
        onClick={onCancel}
        disabled={busy}
        className="mx-auto block text-[14px] leading-[18.2px] font-semibold text-[var(--tt-text-muted)] hover:underline"
      >
        Not now
      </button>
    </>
  );
}

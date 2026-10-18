"use client";

import { useEffect, useRef, useState } from "react";

import { FacebookBrandIcon, GoogleBrandIcon } from "@/components/icons";
import { CodeBoxes } from "@/components/session/auth-modal/CodeBoxes";
import { ModalTitle, PasswordField, PillButton } from "@/components/session/auth-modal/ModalFields";
import { useSession, type SessionUser } from "@/components/session/SessionProvider";
import { AuthCardModal } from "@/components/settings/rows/AuthCardModal";
import {
  ChoosePage,
  ClosureHeader,
  DeactivatePage,
  type Closure,
} from "@/components/settings/rows/close-account/ClosurePages";
import { DownloadDataPage } from "@/components/settings/rows/close-account/DownloadDataPage";
import { LeavingSurvey } from "@/components/settings/rows/close-account/LeavingSurvey";
import { Accessory, ROW_CLASS, RowBody } from "@/components/settings/rows/parts";
import { toast } from "@/components/ui/toast";
import { closureProofFor, type ClosureProof } from "@/lib/account/closure";
import {
  deactivateAccount,
  deleteAccount,
  sendClosureCode,
  type ClosureCredential,
} from "@/lib/api/auth";
import { messageFor } from "@/lib/api/errors";
import { maskEmail } from "@/lib/auth/mask-email";
import {
  getProviderToken,
  isSocialAuthError,
  isSocialCancellation,
  type SocialProvider,
} from "@/lib/auth/social";
import { CODE_LENGTH, emptyCode } from "@/lib/forms/code-digits";
import { cn } from "@/lib/utils";
import type { SettingsRow } from "@/types/tiktok";

/**
 * Manage account → Deactivate or delete account. Signed out, it asks to log in
 * first; signed in, the Settings page swaps its panel for `CloseAccountPanel`.
 */
export function CloseAccountRow({ row, onOpen }: { row: SettingsRow; onOpen: () => void }) {
  const { requireSignIn } = useSession();

  return (
    <button
      type="button"
      onClick={() => {
        if (requireSignIn()) onOpen();
      }}
      className={cn(ROW_CLASS, "hover:bg-white/[0.03]")}
    >
      <RowBody row={row} />
      <Accessory row={row} />
    </button>
  );
}

type Page = "choose" | "deactivate" | "survey" | "download";

const PREVIOUS: Record<Exclude<Page, "choose">, Page> = {
  deactivate: "choose",
  survey: "choose",
  download: "survey",
};

/**
 * "Delete or deactivate?" and the pages after it, in the panel as they are
 * live: deactivate is one page, delete is the leaving survey and then the
 * download-your-data page. The last page's button opens the modal that proves
 * it is you. Once the account is closed the session is gone, and with it this
 * panel.
 */
export function CloseAccountPanel({
  onBack,
  onGoToSection,
  onRequestDownload,
}: {
  onBack: () => void;
  onGoToSection: (id: string) => void;
  onRequestDownload: () => void;
}) {
  const { user } = useSession();
  const [page, setPage] = useState<Page>("choose");
  const [confirming, setConfirming] = useState(false);
  const closure: Closure = page === "deactivate" ? "deactivate" : "delete";

  useEffect(() => {
    if (!user) onBack();
  }, [user, onBack]);

  if (!user) return null;

  return (
    <div className="flex min-h-full flex-col">
      {/* Keyed so each page focuses its back button, which also brings the
          panel back to the top. */}
      <ClosureHeader
        key={page}
        onBack={page === "choose" ? onBack : () => setPage(PREVIOUS[page])}
      />
      {page === "choose" && (
        <ChoosePage
          onChoose={(choice) => setPage(choice === "deactivate" ? "deactivate" : "survey")}
        />
      )}
      {page === "deactivate" && (
        <DeactivatePage username={user.username} onConfirm={() => setConfirming(true)} />
      )}
      {page === "survey" && (
        <LeavingSurvey
          username={user.username}
          onDeactivate={() => setPage("deactivate")}
          onGoToSection={onGoToSection}
          onNext={() => setPage("download")}
        />
      )}
      {page === "download" && (
        <DownloadDataPage
          onRequestDownload={onRequestDownload}
          onConfirm={() => setConfirming(true)}
        />
      )}
      {confirming && (
        <CloseAccountModal user={user} closure={closure} onClose={() => setConfirming(false)} />
      )}
    </div>
  );
}

/**
 * Prove it is you: the password, a code to the account's address, or a fresh
 * sign-in with the linked provider — whichever the account has, so a session
 * left open on someone else's screen cannot close it. On success every session
 * has ended, this one too, and the viewer lands signed out on the feed.
 */
function CloseAccountModal({
  user,
  closure,
  onClose,
}: {
  user: SessionUser;
  closure: Closure;
  onClose: () => void;
}) {
  const { signOut } = useSession();
  const proof = closureProofFor(user);

  const close = async (credential: ClosureCredential) => {
    if (closure === "delete") {
      const { deletionScheduledAt } = await deleteAccount(credential);
      const on = new Date(deletionScheduledAt).toLocaleDateString(undefined, { dateStyle: "long" });
      toast.success(`Your account will be deleted on ${on}. Log in before then to cancel.`);
    } else {
      await deactivateAccount(credential);
      toast.success("Your account is deactivated. Log in again any time to reactivate it.");
    }
    onClose();
    await signOut({ quiet: true });
  };

  return (
    <AuthCardModal stepKey="confirm" onClose={onClose}>
      <ConfirmStep closure={closure} proof={proof} onClose={close} />
    </AuthCardModal>
  );
}

/** Whatever the request throws is toasted and the step stays up for another try. */
function ConfirmStep({
  closure,
  proof,
  onClose,
}: {
  closure: Closure;
  proof: ClosureProof;
  onClose: (credential: ClosureCredential) => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const action = closure === "delete" ? "Delete account" : "Deactivate account";

  const submit = async (credential: ClosureCredential) => {
    setBusy(true);
    try {
      await onClose(credential);
    } catch (cause) {
      toast.error(messageFor(cause));
      setBusy(false);
    }
  };

  return (
    <>
      <ModalTitle className="mb-4">Confirm it&rsquo;s you</ModalTitle>
      {proof.kind === "password" && <PasswordProof action={action} busy={busy} onSubmit={submit} />}
      {proof.kind === "code" && (
        <CodeProof email={proof.email} action={action} busy={busy} onSubmit={submit} />
      )}
      {proof.kind === "provider" && (
        <ProviderProof provider={proof.provider} busy={busy} onSubmit={submit} />
      )}
      {proof.kind === "none" && (
        <p className="mt-10 text-center text-[14px] leading-5 text-[var(--tt-text-muted)]">
          Add an email address to your account first, so we can confirm it&rsquo;s you.
        </p>
      )}
    </>
  );
}

function PasswordProof({
  action,
  busy,
  onSubmit,
}: {
  action: string;
  busy: boolean;
  onSubmit: (credential: ClosureCredential) => Promise<void>;
}) {
  const [password, setPassword] = useState("");

  return (
    <form
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        if (password) void onSubmit({ password });
      }}
    >
      <p className="mb-8 text-center text-[14px] leading-5 text-[var(--tt-text-muted)]">
        Enter your password to continue. You&rsquo;ll be logged out on every device.
      </p>
      <PasswordField value={password} onChange={setPassword} autoFocus />
      <PillButton disabled={!password || busy} className="mt-8 mb-4">
        {busy ? "Confirming…" : action}
      </PillButton>
    </form>
  );
}

function CodeProof({
  email,
  action,
  busy,
  onSubmit,
}: {
  email: string;
  action: string;
  busy: boolean;
  onSubmit: (credential: ClosureCredential) => Promise<void>;
}) {
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);
  const [digits, setDigits] = useState(emptyCode);
  const firstBox = useRef<HTMLInputElement>(null);
  const code = digits.join("");

  useEffect(() => {
    if (sent) firstBox.current?.focus();
  }, [sent]);

  const send = async () => {
    setSending(true);
    try {
      await sendClosureCode();
      setSent(true);
      setDigits(emptyCode());
    } catch (cause) {
      toast.error(messageFor(cause));
    } finally {
      setSending(false);
    }
  };

  return (
    <form
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        if (code.length === CODE_LENGTH) void onSubmit({ otp: code });
      }}
    >
      <p className="mb-8 text-center text-[14px] leading-5 text-[var(--tt-text-muted)]">
        {sent
          ? `Enter the 6-digit code we sent to ${maskEmail(email)}.`
          : `We’ll send a 6-digit code to ${maskEmail(email)} to confirm it’s you.`}
      </p>
      {sent && (
        <div className="flex justify-center">
          <CodeBoxes digits={digits} onChange={setDigits} disabled={busy} firstRef={firstBox} />
        </div>
      )}
      {sent ? (
        <PillButton disabled={code.length !== CODE_LENGTH || busy} className="mt-10 mb-4">
          {busy ? "Confirming…" : action}
        </PillButton>
      ) : (
        <PillButton type="button" onClick={send} disabled={sending} className="mb-4">
          {sending ? "Sending…" : "Send code"}
        </PillButton>
      )}
      {sent && (
        <button
          type="button"
          onClick={send}
          disabled={sending || busy}
          className="mx-auto block text-[14px] leading-[18.2px] font-semibold text-[var(--tt-text-muted)] hover:underline"
        >
          Resend code
        </button>
      )}
    </form>
  );
}

/**
 * A fresh sign-in with the provider the account is linked to; either
 * provider's popup opens from the click.
 */
function ProviderProof({
  provider,
  busy,
  onSubmit,
}: {
  provider: SocialProvider;
  busy: boolean;
  onSubmit: (credential: ClosureCredential) => Promise<void>;
}) {
  const name = provider === "google" ? "Google" : "Facebook";
  const Icon = provider === "google" ? GoogleBrandIcon : FacebookBrandIcon;

  const continueWithProvider = async () => {
    let token: string;
    try {
      token = await getProviderToken(provider);
    } catch (cause) {
      if (!isSocialCancellation(cause)) {
        toast.error(isSocialAuthError(cause) ? cause.message : messageFor(cause));
      }
      return;
    }
    await onSubmit({ provider, token });
  };

  return (
    <>
      <p className="mb-8 text-center text-[14px] leading-5 text-[var(--tt-text-muted)]">
        Log in with {name} again to continue. You&rsquo;ll be logged out on every device.
      </p>
      <button
        type="button"
        disabled={busy}
        onClick={continueWithProvider}
        className="flex h-[46px] w-full items-center justify-center gap-2 rounded-full border border-white/[0.12] text-[16px] leading-[22px] font-semibold text-[var(--tt-text)] hover:bg-white/[0.03] disabled:cursor-not-allowed disabled:opacity-50"
      >
        <Icon className="h-5 w-5" />
        {busy ? "Confirming…" : `Continue with ${name}`}
      </button>
    </>
  );
}

"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import {
  type ClosedAccountSignIn,
  type SocialLinkChallenge,
  useSocialSignIn,
} from "@/components/auth/use-social-sign-in";
import { ChevronLeftIcon, CloseIcon } from "@/components/icons";
import { useSession } from "@/components/session/SessionProvider";
import { modalCardMotion, modalOverlayMotion } from "@/components/ui/modal";
import { toast } from "@/components/ui/toast";
import { useEscapeKey } from "@/hooks/use-escape-key";
import { useFocusTrap } from "@/hooks/use-focus-trap";
import {
  addEmail,
  completePasswordReset,
  forgotPassword,
  resendVerification,
  startSignup,
  verifyEmail,
  verifyPasswordReset,
  verifySignup,
} from "@/lib/api/auth";
import { closedAccountKind, isApiError, messageFor } from "@/lib/api/errors";
import type { OtpSentResponse } from "@/lib/api/types";
import { cn } from "@/lib/utils";
import type { LoginOption } from "@/types/tiktok";

import { AddEmailStep } from "./auth-modal/AddEmailStep";
import { CancelLinkDialog } from "./auth-modal/CancelLinkDialog";
import { CodeStep } from "./auth-modal/CodeStep";
import {
  LoginFormStep,
  NewPasswordStep,
  ResetEmailStep,
} from "./auth-modal/LoginSteps";
import { Agreement, OptionsStep } from "./auth-modal/OptionsStep";
import { ReactivateStep } from "./auth-modal/ReactivateStep";
import {
  EMPTY_DRAFT,
  SignupDetailsStep,
  SignupPasswordStep,
  SignupUsernameStep,
  type SignupDraft,
} from "./auth-modal/SignupSteps";
import { SocialLinkStep } from "./auth-modal/SocialLinkStep";

type Flow = "login" | "signup";

/**
 * Where a code went, and the ticket its code step resends with instead of a
 * Turnstile check — null when the send answered none.
 */
type CodeSent = { email: string; resendTicket: string | null };

/** One screen of the modal. Each keeps what the screens after it need. */
type AuthStep =
  | { name: "options" }
  | { name: "login-form"; identifier?: string }
  | { name: "reset-email" }
  | ({ name: "reset-code" } & CodeSent)
  | { name: "reset-password"; email: string; resetToken: string }
  | { name: "signup-details" }
  | ({ name: "signup-code" } & CodeSent)
  | { name: "signup-password" }
  | { name: "signup-username" }
  /**
   * A login refused for an unconfirmed address (an account made by the
   * older register-then-verify flow). `password` is held so the confirmed
   * address can be logged straight in.
   */
  | { name: "verify"; email: string; password: string }
  /**
   * Already signed in, by a social account whose provider gave no address.
   * They start a fresh stack: the login before them is finished.
   */
  | { name: "add-email" }
  | ({ name: "add-email-code" } & CodeSent)
  /**
   * The credential was right and the account is one its owner closed. It is
   * held so reopening sends the same one back with `reactivate`.
   */
  | {
      name: "reactivate";
      deletionPending: boolean;
      credential:
        | { kind: "password"; identifier: string; password: string }
        | ({ kind: "social" } & SocialLinkChallenge);
    };

type SetFieldError = (name: string, message: string) => void;

const HOME: AuthStep = { name: "options" };

/**
 * `.DivModalContainer` — the login and signup modal. Like the live one it never
 * changes the URL: "Sign up" in the footer, "Use email", "Forgot password?" and
 * every step after them swap the card's content in place, the back chevron
 * steps back through them, and only the tab title follows along.
 *
 * Measured live (1080 and 1920 wide, signed out):
 *   mask     fixed, rgba(0, 0, 0, .68)
 *   card     428 × 562, #1E1E1E, radius 24, 64px reserved for the footer
 *   close    32 × 32 disc at rgba(255, 255, 255, .04), 17px from the top
 *            and 18px from the right
 *   back     24px chevron, 20px from the top and 16px from the left
 *   steps    a 348-wide column; the option list is 380
 *   footer   64 tall, 1px rgba(255, 255, 255, .12) rule, 15/18 with the
 *            link at 15/600 in #FF3B5C
 *   motion   TikTok's shared modal fade and zoom (`modalOverlayMotion`)
 *
 * Signup runs in the live order: birthday and email (a taken address is
 * refused right there), the code mailed to it, a password, then a username —
 * which creates the account, already verified, and logs it in.
 */
export function AuthModal({
  closing,
  loginOptions,
  signupOptions,
  onClose,
}: {
  /** Closed and on its way out: still on screen for `MODAL_EXIT_MS`, but no longer answering. */
  closing: boolean;
  loginOptions: LoginOption[];
  signupOptions: LoginOption[];
  onClose: () => void;
}) {
  const { signIn, signUp, reload } = useSession();
  const [flow, setFlow] = useState<Flow>("login");
  const [stack, setStack] = useState<AuthStep[]>([HOME]);
  const [draft, setDraft] = useState<SignupDraft>(EMPTY_DRAFT);
  const step = stack[stack.length - 1];
  const addingEmail = step.name === "add-email" || step.name === "add-email-code";

  const go = useCallback((next: AuthStep) => setStack((steps) => [...steps, next]), []);
  const back = () => setStack((steps) => (steps.length > 1 ? steps.slice(0, -1) : steps));
  const restart = (nextFlow: Flow, steps: AuthStep[] = [HOME]) => {
    setFlow(nextFlow);
    setStack(steps);
  };

  /**
   * Facebook and Google sign in without leaving the modal — the provider's own
   * dialog is the whole flow, and `signInWithProvider` closes this on success,
   * unless the account has no address: then it stays open to ask for one.
   * The email row opens the email step of whichever flow is showing.
   */
  const social = useSocialSignIn({
    onFallback: useCallback(
      () => go(flow === "login" ? { name: "login-form" } : { name: "signup-details" }),
      [go, flow],
    ),
    onEmailMissing: useCallback(() => setStack([{ name: "add-email" }]), []),
    onAccountClosed: useCallback(
      ({ deletionPending, ...signIn }: ClosedAccountSignIn) =>
        go({ name: "reactivate", deletionPending, credential: { kind: "social", ...signIn } }),
      [go],
    ),
  });

  useEffect(() => {
    const previous = document.title;
    document.title = flow === "login" ? "Log in | Nowa" : "Sign up | Nowa";
    return () => {
      document.title = previous;
    };
  }, [flow]);

  /**
   * Escape and the backdrop are the two ways a modal gets dismissed by
   * accident, and during a social link challenge that costs the provider token
   * — it lives in `useSocialSignIn`'s state and nowhere else, so unmounting
   * strands the code that just arrived by email. So they ask first.
   */
  const { challenge, cancel } = social;
  const [confirmingCancel, setConfirmingCancel] = useState(false);
  const dismiss = useCallback(() => {
    if (challenge) setConfirmingCancel(true);
    else onClose();
  }, [challenge, onClose]);
  useEscapeKey(
    useCallback(() => {
      if (confirmingCancel) setConfirmingCancel(false);
      else dismiss();
    }, [confirmingCancel, dismiss]),
    !closing,
  );
  const dialogRef = useRef<HTMLDivElement>(null);
  useFocusTrap(dialogRef, !closing);

  const switchFlow = (next: Flow) => {
    cancel();
    restart(next);
  };

  const logIn = async (identifier: string, password: string) => {
    try {
      await signIn(identifier, password);
    } catch (cause) {
      /**
       * 403 EMAIL_NOT_VERIFIED is not a failed login: the password was right,
       * the address was just never confirmed. The code step finishes it, and
       * logs in with the password already typed.
       */
      if (isApiError(cause) && cause.is("EMAIL_NOT_VERIFIED")) {
        toast.error(messageFor(cause));
        go({ name: "verify", email: identifier, password });
        return;
      }
      const closed = closedAccountKind(cause);
      if (closed) {
        go({
          name: "reactivate",
          deletionPending: closed === "deletion-pending",
          credential: { kind: "password", identifier, password },
        });
        return;
      }
      throw cause;
    }
  };

  /**
   * `send` mails a code — to a signup's address, or one a social account is
   * adding — and the code step follows, holding the ticket for its resends. An
   * address another account already holds is marked on the field, since the
   * field is what has to change.
   */
  const mailCode = async (
    send: Promise<OtpSentResponse>,
    setFieldError: SetFieldError,
    next: (resendTicket: string | null) => AuthStep,
  ) => {
    let sent: OtpSentResponse;
    try {
      sent = await send;
    } catch (cause) {
      if (isApiError(cause) && cause.is("EMAIL_ALREADY_EXISTS")) {
        setFieldError("email", messageFor(cause));
        return;
      }
      throw cause;
    }
    go(next(sent.resendTicket));
  };

  /** Back to the email, for a signup whose ticket expired or whose address was taken meanwhile. */
  const restartSignup = (cause: unknown) => {
    toast.error(messageFor(cause));
    setDraft((current) => ({ ...current, password: "", signupToken: "" }));
    setStack([HOME, { name: "signup-details" }]);
  };

  const createAccount = async (username: string, setFieldError: SetFieldError) => {
    try {
      // Closes the modal on success.
      await signUp({ signupToken: draft.signupToken, username, password: draft.password });
    } catch (cause) {
      if (isApiError(cause) && cause.is("USERNAME_ALREADY_EXISTS")) {
        setFieldError("username", messageFor(cause));
        return;
      }
      if (
        isApiError(cause) &&
        (cause.is("SIGNUP_SESSION_EXPIRED") || cause.is("EMAIL_ALREADY_EXISTS"))
      ) {
        restartSignup(cause);
        return;
      }
      throw cause;
    }
  };

  const verify = async (email: string, password: string, code: string) => {
    await verifyEmail({ email, otp: code });
    toast.success("Email verified.");
    try {
      // Closes the modal on success.
      await signIn(email, password);
    } catch (cause) {
      // The code is spent, so retyping it would only be refused — finish on
      // the login form instead.
      toast.error(messageFor(cause));
      restart("login", [HOME, { name: "login-form", identifier: email }]);
    }
  };

  /** The session already exists, so this only refreshes `/me` to show the new address. */
  const confirmAddedEmail = async (email: string, code: string) => {
    await verifyEmail({ email, otp: code });
    await reload();
    toast.success("Email verified.");
    onClose();
  };

  const content = (() => {
    switch (step.name) {
      case "options":
        return challenge ? (
          <SocialLinkStep
            challenge={challenge}
            busy={social.pending !== null}
            onConfirm={social.confirm}
            onCancel={cancel}
          />
        ) : (
          <OptionsStep
            title={flow === "login" ? "Log in to Nowa" : "Sign up for Nowa"}
            options={flow === "login" ? loginOptions : signupOptions}
            onSelect={social.select}
            pending={social.pending}
          />
        );

      case "login-form":
        return (
          <LoginFormStep
            initialIdentifier={step.identifier}
            onSubmit={logIn}
            onForgotPassword={() => go({ name: "reset-email" })}
          />
        );

      case "reset-email":
        return (
          <ResetEmailStep
            onSent={async (email, token) => {
              const { resendTicket } = await forgotPassword(email, { turnstileToken: token });
              // The same answer whether or not the address has an account, so
              // the copy must not imply one.
              toast.success("If that address has an account, a reset code is on its way.");
              go({ name: "reset-code", email, resendTicket });
            }}
          />
        );

      case "reset-code":
        return (
          <CodeStep
            email={step.email}
            resendTicket={step.resendTicket}
            onSubmit={async (code) => {
              const { resetToken } = await verifyPasswordReset(step.email, code);
              // The code is spent, so Back from the password goes to the
              // email — which mails a fresh one — not to a dead code screen.
              setStack((steps) => [
                ...steps.slice(0, -1),
                { name: "reset-password", email: step.email, resetToken },
              ]);
            }}
            onResend={(proof) => forgotPassword(step.email, proof)}
          />
        );

      case "reset-password":
        return (
          <NewPasswordStep
            onSubmit={async (password) => {
              try {
                await completePasswordReset({ resetToken: step.resetToken, newPassword: password });
              } catch (cause) {
                if (isApiError(cause) && cause.is("RESET_SESSION_EXPIRED")) {
                  toast.error(messageFor(cause));
                  back();
                  return;
                }
                throw cause;
              }
              // A reset ends every session, this device's included.
              toast.success("Password changed. Log in with your new password.");
              restart("login", [HOME, { name: "login-form", identifier: step.email }]);
            }}
          />
        );

      case "signup-details":
        return (
          <SignupDetailsStep
            draft={draft}
            onChange={(patch) => setDraft((current) => ({ ...current, ...patch }))}
            onSendCode={(email, token, setFieldError) =>
              mailCode(startSignup(email, { turnstileToken: token }), setFieldError, (resendTicket) => ({
                name: "signup-code",
                email,
                resendTicket,
              }))
            }
          />
        );

      case "signup-code":
        return (
          <CodeStep
            email={step.email}
            resendTicket={step.resendTicket}
            onSubmit={async (code) => {
              const { signupToken } = await verifySignup(step.email, code);
              setDraft((current) => ({ ...current, signupToken }));
              // The code is spent, so Back from the password goes to the
              // email — which mails a fresh one — not to a dead code screen.
              setStack((steps) => [...steps.slice(0, -1), { name: "signup-password" }]);
            }}
            onResend={(proof) => startSignup(step.email, proof)}
          />
        );

      case "signup-password":
        return (
          <SignupPasswordStep
            draft={draft}
            onChange={(patch) => setDraft((current) => ({ ...current, ...patch }))}
            onNext={() => go({ name: "signup-username" })}
          />
        );

      case "signup-username":
        return (
          <SignupUsernameStep onSubmit={createAccount} />
        );

      case "verify":
        return (
          <CodeStep
            email={step.email}
            onSubmit={(code) => verify(step.email, step.password, code)}
            onResend={(proof) => resendVerification(step.email, proof)}
          />
        );

      case "add-email":
        return (
          <AddEmailStep
            onSubmit={(email, token, setFieldError) =>
              mailCode(addEmail(email, token), setFieldError, (resendTicket) => ({
                name: "add-email-code",
                email,
                resendTicket,
              }))
            }
            onSkip={onClose}
          />
        );

      case "add-email-code":
        return (
          <CodeStep
            email={step.email}
            resendTicket={step.resendTicket}
            onSubmit={(code) => confirmAddedEmail(step.email, code)}
            onResend={(proof) => resendVerification(step.email, proof)}
          />
        );

      case "reactivate": {
        const { credential } = step;
        return (
          <ReactivateStep
            deletionPending={step.deletionPending}
            onReactivate={() =>
              credential.kind === "password"
                ? signIn(credential.identifier, credential.password, { reactivate: true })
                : social.reactivate(credential)
            }
            onCancel={() => restart(flow)}
          />
        );
      }
    }
  })();

  const showAgreement = step.name === "options" && !challenge;

  return (
    <div
      inert={closing || undefined}
      className={cn(
        "fixed inset-0 z-[3001] flex items-center justify-center",
        modalOverlayMotion(closing),
      )}
    >
      <button
        type="button"
        aria-label="Close"
        onClick={challenge ? undefined : dismiss}
        disabled={Boolean(challenge)}
        className="absolute inset-0 cursor-default bg-black/[0.68] disabled:cursor-not-allowed"
      />

      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        /* Named directly rather than by `aria-labelledby`: the heading changes
           with every step. */
        aria-label={
          challenge
            ? "Confirm it's you"
            : addingEmail
              ? "Add your email"
              : flow === "login"
                ? "Log in to Nowa"
                : "Sign up for Nowa"
        }
        className={cn(
          "relative flex h-[562px] max-h-full w-[428px] max-w-full flex-col overflow-hidden rounded-[24px] bg-[#1e1e1e] pb-16",
          modalCardMotion(closing),
        )}
      >
        <div
          className="no-scrollbar relative min-h-0 flex-1 overflow-y-auto px-2"
          inert={confirmingCancel || undefined}
        >
          {stack.length > 1 && (
            <button
              type="button"
              onClick={back}
              aria-label="Back"
              className="absolute top-5 left-4 flex h-[30px] w-6 items-start text-[var(--tt-text)]"
            >
              <ChevronLeftIcon className="h-6 w-6" />
            </button>
          )}

          {/* Keyed per screen, so stepping back to a screen starts it fresh
              — its values come from the draft, not from a stale form. */}
          <div
            key={`${stack.length}-${step.name}`}
            className={step.name === "options" && !challenge ? "" : "mx-8"}
          >
            {content}
          </div>
        </div>

        {showAgreement && <Agreement flow={flow} />}

        {/* Gone while adding an email: that account is signed in already, so
            there is no other flow to switch to. */}
        {!addingEmail && (
          <div className="absolute inset-x-0 bottom-0 flex h-16 items-center justify-center border-t border-[var(--tt-divider)] text-[15px] leading-[18px] text-[var(--tt-text)]">
            {flow === "login" ? "Don’t have an account?" : "Already have an account?"}
            <button
              type="button"
              onClick={() => switchFlow(flow === "login" ? "signup" : "login")}
              className="ml-[5px] font-semibold text-[var(--tt-red-active)] hover:underline"
            >
              {flow === "login" ? "Sign up" : "Log in"}
            </button>
          </div>
        )}

        <button
          type="button"
          onClick={dismiss}
          aria-label={challenge ? "Cancel verification" : "Close"}
          className="absolute top-[17px] right-[18px] z-10 flex h-8 w-8 items-center justify-center rounded-full bg-white/[0.04] text-[var(--tt-text)] transition-colors hover:bg-white/10"
        >
          <CloseIcon className="h-5 w-5" />
        </button>

        {confirmingCancel && (
          <CancelLinkDialog
            onKeep={() => setConfirmingCancel(false)}
            onCancel={() => {
              setConfirmingCancel(false);
              cancel();
            }}
          />
        )}
      </div>
    </div>
  );
}

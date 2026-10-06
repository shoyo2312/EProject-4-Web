"use client";

import { useId, useState } from "react";

import { TurnstileWidget } from "@/components/auth/TurnstileWidget";
import { toast } from "@/components/ui/toast";
import { messageFor } from "@/lib/api/errors";
import { meetsPasswordRules } from "@/lib/auth/password-rules";
import {
  MONTHS,
  passwordSchema,
  signupDetailsSchema,
  usernameSchema,
} from "@/lib/forms/schemas";
import { useForm } from "@/lib/forms/use-form";

import {
  ConsentCheckbox,
  Dropdown,
  FieldHeading,
  ModalTitle,
  PasswordField,
  PasswordRuleList,
  PillButton,
  TextField,
} from "./ModalFields";

/**
 * Everything the signup steps collect, kept by the modal so stepping back
 * shows what was submitted. The order is the live modal's: birthday and email
 * (which mails the code), the code (which answers `signupToken`), the
 * password, then the username — and only that last step creates the account.
 */
export interface SignupDraft {
  birthMonth: string;
  birthDay: string;
  birthYear: string;
  email: string;
  marketing: boolean;
  password: string;
  /** Proof the mailbox was verified, from `/auth/register/verify`. */
  signupToken: string;
}

export const EMPTY_DRAFT: SignupDraft = {
  birthMonth: "",
  birthDay: "",
  birthYear: "",
  email: "",
  marketing: false,
  password: "",
  signupToken: "",
};

type SetFieldError = (name: string, message: string) => void;

type DraftProps = {
  draft: SignupDraft;
  onChange: (patch: Partial<SignupDraft>) => void;
};

/** 1–31, and a hundred years back from this one, the way the live lists run. */
const DAYS = Array.from({ length: 31 }, (_, index) => String(index + 1));
const THIS_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: 100 }, (_, index) => String(THIS_YEAR - index));

/**
 * Birthday and email, then "Send code". auth-service stores no birthday, but
 * the age gate is still enforced here — it is a promise the form makes either
 * way.
 *
 * Mailing a code is gated on Turnstile server-side, but the live step has no
 * widget on it. So the widget takes the button's place only once "Send code"
 * is pressed, and the code goes out by itself as soon as it is solved.
 */
export function SignupDetailsStep({
  draft,
  onChange,
  onSendCode,
}: DraftProps & {
  /** Resolves once the code is on its way; a taken email is set on the field. */
  onSendCode: (email: string, turnstileToken: string, setFieldError: SetFieldError) => Promise<void>;
}) {
  const emailId = useId();
  /** The address waiting on Turnstile, while the widget is up. */
  const [checking, setChecking] = useState<string | null>(null);
  const form = useForm({
    schema: signupDetailsSchema,
    toastFieldErrors: true,
    initialValues: {
      birthMonth: draft.birthMonth,
      birthDay: draft.birthDay,
      birthYear: draft.birthYear,
      email: draft.email,
    },
    onSubmit: (values) => {
      onChange({ ...values, email: values.email.trim() });
      setChecking(values.email.trim());
    },
  });

  const send = async (token: string) => {
    if (!checking) return;
    try {
      await onSendCode(checking, token, form.setFieldError);
    } catch (cause) {
      toast.error(messageFor(cause));
    } finally {
      // The token is single-use, so a retry mounts a fresh widget.
      setChecking(null);
    }
  };

  const birthdayInvalid = Boolean(form.errors.birthday);
  const complete =
    form.values.birthMonth && form.values.birthDay && form.values.birthYear && form.values.email.trim();

  return (
    <>
      <ModalTitle className="mb-6">Sign up</ModalTitle>

      <form onSubmit={form.handleSubmit} noValidate className="flex flex-col gap-2 pb-2">
        <FieldHeading required className="mb-0.5 leading-[22px]">
          When&rsquo;s your birthday?
        </FieldHeading>
        <div className="flex gap-2">
          <Dropdown
            {...form.field("birthMonth", { focusKey: "birthday" })}
            label="Month"
            options={MONTHS}
            invalid={birthdayInvalid}
          />
          <Dropdown
            {...form.field("birthDay")}
            label="Day"
            options={DAYS}
            invalid={birthdayInvalid}
          />
          <Dropdown
            {...form.field("birthYear")}
            label="Year"
            options={YEARS}
            invalid={birthdayInvalid}
          />
        </div>
        <p className="mb-2 ml-2 text-[12px] leading-5 text-[var(--tt-text-muted)]">
          Your birthday won&rsquo;t be shown publicly.
        </p>

        <FieldHeading required htmlFor={emailId} className="mb-1">
          Enter your email
        </FieldHeading>
        <div>
          <div className="mb-[9px]">
            <TextField
              {...form.field("email")}
              id={emailId}
              type="email"
              placeholder="Email address"
              autoComplete="email"
            />
          </div>

          <div className="mt-[38px] mb-4">
            <ConsentCheckbox
              checked={draft.marketing}
              onChange={(marketing) => onChange({ marketing })}
            >
              Get trending content, newsletters, promotions, recommendations,
              and account updates sent to your email
            </ConsentCheckbox>
          </div>

          {checking ? (
            <div
              ref={(node) => node?.scrollIntoView({ block: "nearest" })}
              className="mt-1.5 mb-4 flex min-h-[71px] justify-center"
            >
              <TurnstileWidget onVerify={send} className="my-0" />
            </div>
          ) : (
            <PillButton disabled={!complete} className="mt-1.5 mb-4">
              Send code
            </PillButton>
          )}
        </div>
      </form>
    </>
  );
}

/** "Enter password", with the rules ticked off as it is typed. */
export function SignupPasswordStep({
  draft,
  onChange,
  onNext,
}: DraftProps & { onNext: () => void }) {
  const passwordId = useId();
  const form = useForm({
    schema: passwordSchema,
    toastFieldErrors: true,
    initialValues: { password: draft.password },
    onSubmit: (values) => {
      onChange({ password: values.password });
      onNext();
    },
  });
  const value = form.values.password;

  return (
    <>
      <ModalTitle className="mb-10">Sign up</ModalTitle>

      <form onSubmit={form.handleSubmit} noValidate className="pt-14 pb-5">
        <FieldHeading required htmlFor={passwordId} className="mb-3">
          Enter password
        </FieldHeading>
        <PasswordField
          {...form.field("password")}
          id={passwordId}
          invalid={value.length > 0 && !meetsPasswordRules(value)}
          autoComplete="new-password"
          autoFocus
        />
        <PasswordRuleList value={value} />

        <PillButton disabled={!meetsPasswordRules(value)} className="mt-[51px] mb-4">
          Next
        </PillButton>
      </form>
    </>
  );
}

/**
 * "Create username" — the step that creates the account and signs it in.
 * "Skip" creates it with a generated handle, which is what the live Skip
 * leaves the account with too; it can be changed later from the profile.
 */
export function SignupUsernameStep({
  onSubmit,
}: {
  onSubmit: (username: string, setFieldError: SetFieldError) => Promise<void>;
}) {
  const usernameId = useId();
  const [skipping, setSkipping] = useState(false);

  const form = useForm({
    schema: usernameSchema,
    toastFieldErrors: true,
    initialValues: { username: "" },
    onSubmit: (values, { setFieldError }) => onSubmit(values.username.trim(), setFieldError),
  });
  const busy = form.submitting || skipping;

  const skip = async () => {
    setSkipping(true);
    try {
      await onSubmit(randomUsername(), form.setFieldError);
    } catch (cause) {
      toast.error(messageFor(cause));
    } finally {
      setSkipping(false);
    }
  };

  return (
    <form onSubmit={form.handleSubmit} noValidate>
      <ModalTitle className="mb-24">Sign up</ModalTitle>

      <label
        htmlFor={usernameId}
        className="mb-[5px] block text-[15px] leading-[22.5px] font-semibold text-[var(--tt-text)]"
      >
        Create username
      </label>
      <TextField
        {...form.field("username")}
        id={usernameId}
        placeholder="Username"
        autoComplete="username"
        autoFocus
      />
      <p className="mt-3 text-[12px] leading-[15px] text-[var(--tt-text-muted)]">
        You can always change this later.
      </p>

      <PillButton
        disabled={busy || !form.values.username.trim()}
        className="mt-20 mb-4"
      >
        {busy ? "Creating account…" : "Continue"}
      </PillButton>

      <button
        type="button"
        disabled={busy}
        onClick={() => void skip()}
        className="mt-[22px] block w-full text-center text-[14px] leading-[18.2px] font-bold text-[var(--tt-text-muted)] disabled:cursor-not-allowed disabled:opacity-60"
      >
        Skip
      </button>
    </form>
  );
}

/** `user` + 6 lowercase-alphanumeric chars — inside `usernameField`'s rules. */
function randomUsername(): string {
  return "user" + Math.random().toString(36).slice(2, 8).padEnd(6, "0");
}

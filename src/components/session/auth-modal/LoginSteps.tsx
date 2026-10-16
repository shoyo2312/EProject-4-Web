"use client";

import { useId } from "react";

import { TurnstileWidget } from "@/components/auth/TurnstileWidget";
import { useTurnstileToken } from "@/lib/auth/use-turnstile-token";
import { meetsPasswordRules } from "@/lib/auth/password-rules";
import { emailSchema, loginSchema, passwordSchema } from "@/lib/forms/schemas";
import { useForm, type SubmitHelpers } from "@/lib/forms/use-form";

import {
  FieldHeading,
  ModalTitle,
  PasswordField,
  PasswordRuleList,
  PillButton,
  TextField,
} from "./ModalFields";

/**
 * "Log in" — email or username, then a password.
 *
 * The live step opens with a Phone / "Username or email" switch; there is no
 * phone sign-in here, so the switch is left out and its 75px kept, which puts
 * the fields, Continue and "Forgot password?" exactly where they are live.
 */
export function LoginFormStep({
  initialIdentifier = "",
  onSubmit,
  onForgotPassword,
}: {
  initialIdentifier?: string;
  onSubmit: (identifier: string, password: string) => Promise<void>;
  onForgotPassword: () => void;
}) {
  const form = useForm({
    schema: loginSchema,
    toastFieldErrors: true,
    initialValues: { identifier: initialIdentifier, password: "" },
    onSubmit: (values) => onSubmit(values.identifier.trim(), values.password),
  });

  const filled = form.values.identifier.trim() && form.values.password;

  return (
    <>
      <ModalTitle className="mb-8">Log in</ModalTitle>

      <form onSubmit={form.handleSubmit} noValidate className="pt-[75px] pb-5">
        <div className="mb-3">
          <TextField
            {...form.field("identifier")}
            placeholder="Email or username"
            autoComplete="username"
            autoFocus={!initialIdentifier}
          />
        </div>
        <PasswordField {...form.field("password")} autoFocus={Boolean(initialIdentifier)} />

        <PillButton disabled={!filled || form.submitting} className="mt-[69px] mb-4">
          {form.submitting ? "Logging in…" : "Continue"}
        </PillButton>

        <button
          type="button"
          onClick={onForgotPassword}
          className="mx-auto block text-[14px] leading-[18.2px] font-semibold text-[var(--tt-text-muted)] hover:underline"
        >
          Forgot password?
        </button>
      </form>
    </>
  );
}

/**
 * "Reset password", first half: where to send the code. Live, a Phone / Email
 * switch sits over the field; email is the only way here, so it is left out
 * and its space kept. Turnstile fills the gap the live step leaves above
 * Continue — sending a reset code is gated on it.
 */
export function ResetEmailStep({
  onSent,
}: {
  onSent: (email: string, turnstileToken: string) => Promise<void>;
}) {
  const turnstile = useTurnstileToken();
  const form = useForm({
    schema: emailSchema,
    toastFieldErrors: true,
    initialValues: { email: "" },
    onSubmit: async (values) => {
      try {
        await onSent(values.email.trim(), turnstile.token ?? "");
      } finally {
        turnstile.consume();
      }
    },
  });

  return (
    <>
      <ModalTitle className="mb-8">Reset password</ModalTitle>

      <form onSubmit={form.handleSubmit} noValidate className="px-4 pt-[75px] pb-5">
        <TextField
          {...form.field("email")}
          type="email"
          placeholder="Email address"
          autoComplete="email"
          autoFocus
        />

        <div className="mt-6 flex min-h-[71px] justify-center">
          <TurnstileWidget
            key={turnstile.widgetKey}
            onVerify={turnstile.setToken}
            className="my-0"
          />
        </div>

        <PillButton
          disabled={!form.values.email.trim() || !turnstile.token || form.submitting}
          className="mt-[33px] mb-4"
        >
          {form.submitting ? "Sending…" : "Continue"}
        </PillButton>
      </form>
    </>
  );
}

/**
 * "Reset password", second half: the new password, checked against the same
 * rules as signup. The code was already checked on the step before; this
 * redeems the ticket it answered. Settings' "Set password" reuses it.
 */
export function NewPasswordStep({
  title = "Reset password",
  submitLabel = "Reset password",
  onSubmit,
}: {
  title?: string;
  submitLabel?: string;
  onSubmit: (
    password: string,
    setFieldError: SubmitHelpers["setFieldError"],
  ) => Promise<void>;
}) {
  const passwordId = useId();
  const form = useForm({
    schema: passwordSchema,
    toastFieldErrors: true,
    initialValues: { password: "" },
    onSubmit: (values, { setFieldError }) => onSubmit(values.password, setFieldError),
  });
  const value = form.values.password;

  return (
    <>
      <ModalTitle className="mb-10">{title}</ModalTitle>

      <form onSubmit={form.handleSubmit} noValidate className="pt-14 pb-5">
        <FieldHeading required htmlFor={passwordId} className="mb-3">
          Enter new password
        </FieldHeading>
        <PasswordField
          {...form.field("password")}
          id={passwordId}
          invalid={value.length > 0 && !meetsPasswordRules(value)}
          placeholder="New password"
          autoComplete="new-password"
          autoFocus
        />
        <PasswordRuleList value={value} />

        <PillButton
          disabled={!meetsPasswordRules(value) || form.submitting}
          className="mt-[51px] mb-4"
        >
          {form.submitting ? "Saving…" : submitLabel}
        </PillButton>
      </form>
    </>
  );
}

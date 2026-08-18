"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

import { AuthShell } from "@/components/auth/AuthShell";
import {
  AuthInput,
  AuthSubmit,
  AuthTitle,
  FieldLabel,
  FormNotice,
  GoBack,
  OtpInput,
} from "@/components/auth/AuthFields";
import { resendVerification, verifyEmail } from "@/lib/api/auth";
import { isApiError, messageFor } from "@/lib/api/errors";
import { verifyEmailSchema } from "@/lib/forms/schemas";
import { useForm } from "@/lib/forms/use-form";

const VERIFIED_LOGIN_HREF = "/login/phone-or-email/email?verified=1";

/**
 * Keeps a `next` from the query string pointed at this site: exactly one
 * leading slash, and nothing slash-like behind it. `https://evil.example` and
 * `//evil.example` are plainly absolute; `/\evil.example` is too, because
 * browsers read a backslash in that position as a slash. A redirect the
 * attacker chooses, landing the moment a code was accepted, is exactly the
 * opening a fake login page wants.
 */
function internalPath(next: string | null): string | null {
  return next && /^\/(?![/\\])/.test(next) ? next : null;
}

/**
 * `/signup/verify` — the step between registering and being able to log in.
 *
 * Reached two ways: straight after `POST /register`, and from a login that came
 * back 403 `EMAIL_NOT_VERIFIED`. The address arrives in the query string so a
 * reload does not lose it.
 *
 * Two independent server-side counters bite here, and they are counted
 * separately: five wrong codes per 15 minutes, and three resends per 15
 * minutes. Neither tells the client how many tries are left, so wrong attempts
 * are counted locally to warn before the wall is hit.
 */
export function VerifyEmailPage() {
  const router = useRouter();
  const params = useSearchParams();

  const [notice, setNotice] = useState<string | null>(null);
  const [wrongAttempts, setWrongAttempts] = useState(0);

  const form = useForm({
    schema: verifyEmailSchema,
    initialValues: { email: params.get("email") ?? "", otp: "" },
    onSubmit: async (values, { setFieldError }) => {
      setNotice(null);
      try {
        await verifyEmail({ email: values.email.trim(), otp: values.otp });
      } catch (cause) {
        // A wrong code is the code's problem, so it is reported on the code —
        // and the caret goes back into the field being retyped.
        if (isApiError(cause) && cause.is("INVALID_OTP")) {
          setWrongAttempts((count) => count + 1);
          setFieldError("otp", messageFor(cause));
          return;
        }
        throw cause;
      }
      // Verification does not create a session — the account still has to log
      // in, so the flow lands on the password form with nothing carried over.
      // Unless `next` says otherwise: an account that got here from add-email
      // is already signed in, and sending it to a login form would be absurd.
      router.push(internalPath(params.get("next")) ?? VERIFIED_LOGIN_HREF);
    },
  });

  const resend = async () => {
    form.setFormError(null);
    setNotice(null);
    try {
      await resendVerification(form.values.email.trim());
      // Always 204, even for an address that has no account — the server
      // refuses to confirm whether one exists, so the wording stays neutral.
      // Issuing a code deletes the account's previous one of the same type, so
      // an old email in the inbox is now dead — say it before it is retyped.
      setNotice(
        "If that address has an account, a new code is on its way — the previous code stops working.",
      );
      form.setValue("otp", "");
    } catch (cause) {
      form.setFormError(messageFor(cause));
    }
  };

  return (
    <AuthShell
      altPrompt="Already have an account?"
      altLabel="Log in"
      altHref="/login"
    >
      <div className="mx-auto mt-16 w-[363px] max-w-[calc(100%-1.5rem)]">
        <div className="text-left">
          <AuthTitle>Verify your email</AuthTitle>
          <p className="mb-6 text-[14px] leading-5 text-[var(--tt-text-secondary)]">
            Enter the 6-digit code we sent you. It expires 15 minutes after it
            was sent.
          </p>

          <form onSubmit={form.handleSubmit} noValidate>
            <FieldLabel>Email</FieldLabel>
            <AuthInput
              {...form.field("email")}
              type="email"
              placeholder="Email address"
              autoComplete="email"
            />

            <FieldLabel>Verification code</FieldLabel>
            <OtpInput {...form.field("otp")} onResend={resend} />

            {wrongAttempts >= 3 && !form.hasErrors && (
              <FormNotice>
                After five wrong codes the address is locked for 15 minutes.
              </FormNotice>
            )}
            {notice && <FormNotice>{notice}</FormNotice>}
            {form.formError && <FormNotice error>{form.formError}</FormNotice>}

            <AuthSubmit disabled={form.submitting}>
              {form.submitting ? "Verifying…" : "Verify"}
            </AuthSubmit>
          </form>

          <GoBack href="/login" />
        </div>
      </div>
    </AuthShell>
  );
}

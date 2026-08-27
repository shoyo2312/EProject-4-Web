"use client";

import { useRouter } from "next/navigation";
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
  PasswordInput,
} from "@/components/auth/AuthFields";
import { TurnstileWidget } from "@/components/auth/TurnstileWidget";
import { forgotPassword, resetPassword } from "@/lib/api/auth";
import { isApiError, messageFor } from "@/lib/api/errors";
import { useTurnstileToken } from "@/lib/auth/use-turnstile-token";
import { forgotPasswordSchema, resetPasswordSchema } from "@/lib/forms/schemas";
import { useForm } from "@/lib/forms/use-form";

/**
 * `/login/forgot-password` — request a code, then set a new password with it.
 *
 * Both steps live on one route because the second is useless without the
 * first, and the address has to survive between them.
 *
 * A successful reset kills every session the account has, on every device,
 * including this one. That is deliberate on the server's side (a reset usually
 * means "I think I was compromised"), so this screen sends the viewer to the
 * login form afterwards instead of pretending they are still signed in.
 */
export function ForgotPasswordPage() {
  const router = useRouter();

  const [stage, setStage] = useState<"request" | "reset">("request");
  const [email, setEmail] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const turnstile = useTurnstileToken();

  /**
   * Two forms, not one with a branch: the stages share no field, and one
   * `useForm` per stage keeps each schema honest about what is on screen —
   * including the order errors are focused in.
   */
  const request = useForm({
    schema: forgotPasswordSchema,
    initialValues: { email: "" },
    onSubmit: async (values) => {
      const address = values.email.trim();
      try {
        await forgotPassword(address, turnstile.token ?? "");
      } finally {
        turnstile.consume();
      }
      // 204 regardless of whether the address exists — the response is
      // deliberately uninformative, so the copy is too.
      setEmail(address);
      setNotice("If that address has an account, a reset code is on its way.");
      setStage("reset");
    },
  });

  const reset = useForm({
    schema: resetPasswordSchema,
    initialValues: { otp: "", password: "" },
    onSubmit: async (values, { setFieldError }) => {
      try {
        await resetPassword({
          email,
          otp: values.otp,
          newPassword: values.password,
        });
      } catch (cause) {
        if (isApiError(cause) && cause.is("INVALID_OTP")) {
          setFieldError("otp", messageFor(cause));
          return;
        }
        throw cause;
      }
      router.push("/login/phone-or-email/email?reset=1");
    },
  });

  /**
   * A resend is the same request as the first one, and it is rate limited the
   * same way — three per address per 15 minutes. A refused resend has to say
   * so, otherwise the button looks broken while the wall is silently hit.
   */
  const resendCode = async () => {
    reset.setFormError(null);
    setNotice(null);
    try {
      await forgotPassword(email, turnstile.token ?? "");
      // Neutral for the same reason the first request is: the server answers 204
      // whether or not the address has an account, so the copy must not imply one.
      setNotice(
        "If that address has an account, a new code is on its way — the previous code stops working.",
      );
      reset.setValue("otp", "");
    } catch (cause) {
      reset.setFormError(messageFor(cause));
    } finally {
      turnstile.consume();
    }
  };

  return (
    <AuthShell
      altPrompt="Don’t have an account?"
      altLabel="Sign up"
      altHref="/signup"
    >
      <div className="mx-auto mt-16 w-[363px] max-w-[calc(100%-1.5rem)]">
        <div className="text-left">
          <AuthTitle>Reset password</AuthTitle>

          {stage === "request" ? (
            <form onSubmit={request.handleSubmit} noValidate>
              <p className="mb-6 text-[14px] leading-5 text-[var(--tt-text-secondary)]">
                We’ll email you a 6-digit code. You can ask for three codes
                every 15 minutes.
              </p>

              <FieldLabel>Email</FieldLabel>
              <AuthInput
                {...request.field("email")}
                type="email"
                placeholder="Email address"
                autoComplete="email"
              />

              {request.formError && (
                <FormNotice error>{request.formError}</FormNotice>
              )}

              <div className="flex justify-center">
                <TurnstileWidget key={turnstile.widgetKey} onVerify={turnstile.setToken} />
              </div>

              <AuthSubmit disabled={request.submitting || !turnstile.token}>
                {request.submitting ? "Sending…" : "Send code"}
              </AuthSubmit>
            </form>
          ) : (
            <form onSubmit={reset.handleSubmit} noValidate>
              <p className="mb-6 text-[14px] leading-5 text-[var(--tt-text-secondary)]">
                Resetting your password signs you out everywhere, including on
                this device.
              </p>

              <FieldLabel>Verification code</FieldLabel>
              <OtpInput
                {...reset.field("otp")}
                onResend={resendCode}
                resendDisabled={!turnstile.token}
              />

              {/* Gates the resend above, not this submit — reset spends a
                  code, it doesn't issue one. */}
              <TurnstileWidget key={turnstile.widgetKey} onVerify={turnstile.setToken} />

              <FieldLabel>New password</FieldLabel>
              <PasswordInput
                {...reset.field("password")}
                autoComplete="new-password"
                placeholder="New password"
              />

              {notice && <FormNotice>{notice}</FormNotice>}
              {reset.formError && <FormNotice error>{reset.formError}</FormNotice>}

              <AuthSubmit disabled={reset.submitting}>
                {reset.submitting ? "Saving…" : "Reset password"}
              </AuthSubmit>
            </form>
          )}

          <GoBack href="/login/phone-or-email/email" />
        </div>
      </div>
    </AuthShell>
  );
}

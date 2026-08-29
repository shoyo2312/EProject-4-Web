"use client";

import { useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { AuthShell } from "@/components/auth/AuthShell";
import {
  AuthInput,
  AuthSubmit,
  AuthTitle,
  FieldLabel,
  FormNotice,
  GoBack,
  PasswordInput,
  SubtleLink,
} from "@/components/auth/AuthFields";
import { AuthAgreement, AuthOptions } from "@/components/auth/AuthOptions";
import { SocialLinkForm } from "@/components/auth/SocialLinkForm";
import { useSocialSignIn } from "@/components/auth/use-social-sign-in";
import { useSession } from "@/components/session/SessionProvider";
import { isApiError } from "@/lib/api/errors";
import { loginSchema } from "@/lib/forms/schemas";
import { useForm } from "@/lib/forms/use-form";
import type { LoginOption } from "@/types/tiktok";

/** The live routes, which this clone keeps. */
const OPTIONS_HREF = "/login";
const EMAIL_HREF = "/login/phone-or-email/email";

/**
 * `/login`, in its two live steps. Each is its own URL, so the browser's
 * back button walks the flow exactly as it does on the live site.
 *
 * The email step is wired to `POST /api/v1/auth/login` through the gateway,
 * and the Facebook and Google rows to `POST /api/v1/auth/oauth/{provider}`.
 * The rest are not: there is no SMS sender, and no LINE/Kakao/Apple app
 * registered, so they lead to the email form rather than faking a session.
 * There is no phone step — auth-service has no phone column.
 */
export function LoginPage({
  step,
  options,
}: {
  step: "options" | "email";
  options: LoginOption[];
}) {
  return (
    <AuthShell
      altPrompt="Don’t have an account?"
      altLabel="Sign up"
      altHref="/signup"
      agreement={step === "options" && <AuthAgreement verb="continuing" />}
    >
      <div className="mx-auto mt-16 w-[363px] max-w-[calc(100%-1.5rem)] text-center">
        {step === "options" ? (
          <OptionsStep options={options} />
        ) : (
          <div className="text-left">
            <AuthTitle>Log in</AuthTitle>
            <EmailForm />
            <GoBack href={OPTIONS_HREF} />
          </div>
        )}
      </div>
    </AuthShell>
  );
}

/**
 * `/login`'s row list. The Facebook and Google rows sign in for real through
 * `/auth/oauth/{provider}`; every other row still leads to the email form,
 * which is the only other flow this deployment has.
 */
function OptionsStep({ options }: { options: LoginOption[] }) {
  const router = useRouter();
  const social = useSocialSignIn({
    onFallback: useCallback(() => router.push(EMAIL_HREF), [router]),
    redirectTo: "/",
  });

  if (social.challenge) {
    return (
      <SocialLinkForm
        challenge={social.challenge}
        onConfirm={social.confirm}
        onCancel={social.cancel}
        error={social.error}
        busy={social.pending !== null}
      />
    );
  }

  return (
    <AuthOptions
      title="Log in to Nowa"
      description="Manage your account, check notifications, comment on videos, and more."
      options={options}
      onSelect={social.select}
      pending={social.pending}
      error={social.error}
    />
  );
}

/** `/login/phone-or-email/email` — email or username, plus a password. */
function EmailForm() {
  const router = useRouter();
  const { signIn } = useSession();
  // Set by the OTP screen on its way here. Without it, confirming an address
  // dropped the viewer on a bare login form with no sign the code worked.
  const justVerified = useSearchParams().get("verified") === "1";

  const form = useForm({
    schema: loginSchema,
    errorToast: false,
    initialValues: { identifier: "", password: "" },
    onSubmit: async (values) => {
      const identifier = values.identifier.trim();
      try {
        await signIn(identifier, values.password);
      } catch (cause) {
        /**
         * 403 EMAIL_NOT_VERIFIED is not a failed login: the password was right,
         * the account just never confirmed its address. The contract separates
         * it from 401 precisely so the client can send the viewer to the OTP
         * screen, and this branch is the whole reason for that separation.
         */
        if (isApiError(cause) && cause.is("EMAIL_NOT_VERIFIED")) {
          router.push(`/signup/verify?email=${encodeURIComponent(identifier)}`);
          return;
        }
        /**
         * Everything else stays a form-level message. A rejected login is
         * deliberately not attributed to a field: the server answers
         * `INVALID_CREDENTIALS` without saying which half was wrong, and
         * guessing would tell an attacker which usernames exist.
         */
        throw cause;
      }
      router.push("/");
    },
  });

  return (
    <form onSubmit={form.handleSubmit} noValidate>
      {justVerified && (
        <FormNotice>
          Your email address is verified — log in to finish.
        </FormNotice>
      )}

      <FieldLabel>Email or username</FieldLabel>

      <AuthInput
        {...form.field("identifier")}
        placeholder="Email or username"
        autoComplete="username"
      />
      <PasswordInput {...form.field("password")} />
      <SubtleLink href="/login/forgot-password">Forgot password?</SubtleLink>

      {form.formError && <FormNotice error>{form.formError}</FormNotice>}

      <AuthSubmit disabled={form.submitting}>
        {form.submitting ? "Logging in…" : "Log in"}
      </AuthSubmit>
    </form>
  );
}

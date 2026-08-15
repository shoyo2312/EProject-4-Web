"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";

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
import { useSocialSignIn } from "@/components/auth/use-social-sign-in";
import { useSession } from "@/components/session/SessionProvider";
import { isApiError } from "@/lib/api/errors";
import { loginSchema } from "@/lib/forms/schemas";
import { useForm } from "@/lib/forms/use-form";
import type { LoginOption } from "@/types/tiktok";

/** The live routes, which this clone keeps. */
const OPTIONS_HREF = "/login";
const PHONE_HREF = "/login/phone-or-email";
const EMAIL_HREF = "/login/phone-or-email/email";

/**
 * `/login`, in its three live steps. Each is its own URL, so the browser's
 * back button walks the flow exactly as it does on the live site.
 *
 * The email step is wired to `POST /api/v1/auth/login` through the gateway,
 * and the Facebook and Google rows to `POST /api/v1/auth/oauth/{provider}`.
 * The rest are not: there is no SMS sender, and no LINE/Kakao/Apple app
 * registered, so they lead to the email form rather than faking a session.
 */
export function LoginPage({
  step,
  options,
}: {
  step: "options" | "phone" | "email";
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
            {step === "phone" ? <PhoneNotice /> : <EmailForm />}
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

  return (
    <AuthOptions
      title="Log in to TikTok"
      description="Manage your account, check notifications, comment on videos, and more."
      options={options}
      onSelect={social.select}
      pending={social.pending}
      error={social.error}
    />
  );
}

/**
 * `/login/phone-or-email`. auth-service authenticates on username/email and
 * password only — there is no phone column and no SMS sender — so this step
 * points at the form that works instead of collecting a number nothing reads.
 */
function PhoneNotice() {
  return (
    <div className="mt-4">
      <FormNotice>
        Phone login isn’t available on this deployment. The backend signs you in
        with a username or email address and a password.
      </FormNotice>
      <SubtleLink href={EMAIL_HREF}>Log in with email or username</SubtleLink>
    </div>
  );
}

/** `/login/phone-or-email/email` — email or username, plus a password. */
function EmailForm() {
  const router = useRouter();
  const { signIn } = useSession();

  const form = useForm({
    schema: loginSchema,
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
      <FieldLabel switchTo={{ label: "Log in with phone", href: PHONE_HREF }}>
        Email or username
      </FieldLabel>

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

"use client";

import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";

import { AuthShell } from "@/components/auth/AuthShell";
import {
  AuthInput,
  AuthSubmit,
  AuthTitle,
  FieldLabel,
  FormNotice,
  GoBack,
  PasswordInput,
  Selector,
} from "@/components/auth/AuthFields";
import { AuthAgreement, AuthOptions } from "@/components/auth/AuthOptions";
import { SocialLinkForm } from "@/components/auth/SocialLinkForm";
import { useSocialSignIn } from "@/components/auth/use-social-sign-in";
import { register } from "@/lib/api/auth";
import { isApiError, messageFor } from "@/lib/api/errors";
import { MONTHS, signupSchema } from "@/lib/forms/schemas";
import { useForm } from "@/lib/forms/use-form";
import type { LoginOption } from "@/types/tiktok";

const OPTIONS_HREF = "/signup";
const EMAIL_HREF = "/signup/phone-or-email/email";

/**
 * `/signup`. The email step calls `POST /api/v1/auth/register`.
 *
 * Registering does **not** sign you in: the account comes back with
 * `emailVerified: false`, and logging in before confirming it is answered with
 * 403. So the button hands over to the OTP screen — register → verify → log
 * in — which is the flow the contract mandates, not register → feed.
 */
export function SignupPage({
  step,
  options,
}: {
  step: "options" | "email";
  options: LoginOption[];
}) {
  return (
    <AuthShell
      altPrompt="Already have an account?"
      altLabel="Log in"
      altHref="/login"
      agreement={step === "options" && <AuthAgreement verb="continuing" />}
    >
      <div className="mx-auto mt-16 w-[363px] max-w-[calc(100%-1.5rem)] text-center">
        {step === "options" ? (
          <OptionsStep options={options} />
        ) : (
          <div className="text-left">
            <AuthTitle>Sign up</AuthTitle>
            <SignupForm />
            <GoBack href={OPTIONS_HREF} />
          </div>
        )}
      </div>
    </AuthShell>
  );
}

/**
 * `/signup`'s row list. Facebook and Google create the account *and* sign in
 * in one step — `/auth/oauth/{provider}` registers on first use and there is
 * no email to verify — which is why they land on the feed while the email row
 * still has to go through the OTP screen.
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
      title="Sign up for TikTok"
      description="Create a profile, follow other accounts, make your own videos, and more."
      options={options}
      onSelect={social.select}
      pending={social.pending}
      error={social.error}
    />
  );
}

function SignupForm() {
  const router = useRouter();

  const form = useForm({
    schema: signupSchema,
    initialValues: {
      // The birthday block is the live page's. auth-service stores no date of
      // birth, so nothing is sent with it — but it is still validated, because
      // the age gate is a promise the form makes to the reader either way.
      birthMonth: "",
      birthDay: "",
      birthYear: "",
      email: "",
      username: "",
      password: "",
    },
    onSubmit: async (values, { setFieldError }) => {
      try {
        await register({
          username: values.username.trim(),
          email: values.email.trim(),
          password: values.password,
        });
      } catch (cause) {
        /**
         * The two conflicts the server alone can detect. They belong under the
         * field that has to change, not in a line at the bottom of the form —
         * and `setFieldError` focuses it, exactly as a local failure would.
         */
        if (isApiError(cause) && cause.is("USERNAME_ALREADY_EXISTS")) {
          setFieldError("username", messageFor(cause));
          return;
        }
        if (isApiError(cause) && cause.is("EMAIL_ALREADY_EXISTS")) {
          setFieldError("email", messageFor(cause));
          return;
        }
        throw cause;
      }

      // The OTP is already on its way — the server sends it as part of
      // registration, so the next screen only has to collect it.
      router.push(
        `/signup/verify?email=${encodeURIComponent(values.email.trim())}`,
      );
    },
  });

  const birthday = form.errors.birthday;

  return (
    <form onSubmit={form.handleSubmit} noValidate>
      {/* `.DivAgeSelector` — three 115-wide selects, 8px apart. */}
      <div className="mt-7 mb-1 text-[16px] leading-[22px] font-semibold text-[var(--tt-text)]">
        When&rsquo;s your birthday?
      </div>
      <div className="mb-1 flex gap-2">
        {/* One message for the row, and the Month select owns the focus for
            it — see `focusKey` in `useForm`. */}
        <Selector
          {...form.field("birthMonth", { focusKey: "birthday" })}
          label="Month"
          options={MONTHS}
          placeholder="Month"
          invalid={Boolean(birthday)}
          className="min-w-0 flex-1"
        />
        <Selector
          {...form.field("birthDay")}
          label="Day"
          options={DAYS}
          placeholder="Day"
          invalid={Boolean(birthday)}
          className="min-w-0 flex-1"
        />
        <Selector
          {...form.field("birthYear")}
          label="Year"
          options={YEARS}
          placeholder="Year"
          invalid={Boolean(birthday)}
          className="min-w-0 flex-1"
        />
      </div>
      {birthday ? (
        <p role="alert" className="mb-4 text-[13px] leading-[18px] text-[var(--tt-red-active)]">
          {birthday}
        </p>
      ) : (
        <p className="mb-4 text-[14px] leading-5 text-[var(--tt-text-muted)]">
          Your birthday won&rsquo;t be shown publicly.
        </p>
      )}

      <FieldLabel className="mb-[5px]">Email</FieldLabel>

      <AuthInput
        {...form.field("email")}
        type="email"
        placeholder="Email address"
        autoComplete="email"
      />
      <AuthInput
        {...form.field("username")}
        placeholder="Username"
        autoComplete="username"
      />
      <PasswordInput
        {...form.field("password")}
        autoComplete="new-password"
        placeholder="Password"
      />

      <MarketingOptIn />

      {form.formError && <FormNotice error>{form.formError}</FormNotice>}

      <AuthSubmit disabled={form.submitting}>
        {form.submitting ? "Creating account…" : "Next"}
      </AuthSubmit>
    </form>
  );
}

/** `.DivCheckboxWrapper` — a 22px square box, then 12/16/400 text at .75. */
function MarketingOptIn() {
  const [checked, setChecked] = useState(false);

  return (
    <label className="flex cursor-pointer items-start">
      <span className="mr-2 flex-none">
        <input
          type="checkbox"
          checked={checked}
          onChange={(event) => setChecked(event.target.checked)}
          className="h-[22px] w-[22px] appearance-none border border-[rgb(255_255_255/0.5)] bg-[#121212] checked:border-[var(--tt-red)] checked:bg-[var(--tt-red)]"
        />
      </span>
      <span className="text-center text-[12px] leading-4 text-[rgb(255_255_255/0.75)]">
        Get trending content, newsletters, promotions, recommendations, and
        account updates sent to your email
      </span>
    </label>
  );
}

/** 1–31 and a hundred years back from 2026, the way the live selects list them. */
const DAYS = Array.from({ length: 31 }, (_, index) => String(index + 1));
const YEARS = Array.from({ length: 100 }, (_, index) => String(2026 - index));

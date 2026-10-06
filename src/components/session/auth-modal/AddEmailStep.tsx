"use client";

import { TurnstileWidget } from "@/components/auth/TurnstileWidget";
import { useTurnstileToken } from "@/lib/auth/use-turnstile-token";
import { emailSchema } from "@/lib/forms/schemas";
import { useForm, type SubmitHelpers } from "@/lib/forms/use-form";

import { ModalTitle, PillButton, TextField } from "./ModalFields";

/**
 * "Add your email" — where a social login lands when the provider handed over
 * no address. Facebook's `email` permission is optional and an account
 * registered with a phone number has none to give, so this is a normal outcome
 * rather than an error.
 *
 * The session is already live and stays usable if the viewer skips: what an
 * address buys is a way back in. Without one the account cannot reset a
 * password or be reached at all, so losing the Facebook account would mean
 * losing this one. That is what the step says, and why it can be skipped —
 * every social login asks again until the account has one.
 *
 * TikTok has no such screen to measure, so it borrows the reset step's layout,
 * the other place an address is asked for on its own.
 */
export function AddEmailStep({
  onSubmit,
  onSkip,
}: {
  /** Stores the address and mails a code to it; a taken one is set on the field. */
  onSubmit: (
    email: string,
    turnstileToken: string,
    setFieldError: SubmitHelpers["setFieldError"],
  ) => Promise<void>;
  onSkip: () => void;
}) {
  const turnstile = useTurnstileToken();
  const form = useForm({
    schema: emailSchema,
    toastFieldErrors: true,
    initialValues: { email: "" },
    onSubmit: async (values, { setFieldError }) => {
      try {
        await onSubmit(values.email.trim(), turnstile.token ?? "", setFieldError);
      } finally {
        turnstile.consume();
      }
    },
  });

  return (
    <>
      <ModalTitle className="mb-4">Add your email</ModalTitle>

      <p className="text-center text-[14px] leading-5 text-[var(--tt-text-muted)]">
        You&rsquo;re logged in, but this account has no email address. Add one
        so you can still get in if you lose the account you just used.
      </p>

      <form onSubmit={form.handleSubmit} noValidate className="pt-6 pb-5">
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
          className="mt-6 mb-4"
        >
          {form.submitting ? "Sending…" : "Send code"}
        </PillButton>

        <button
          type="button"
          onClick={onSkip}
          className="mx-auto block text-[14px] leading-[18.2px] font-semibold text-[var(--tt-text-muted)] hover:underline"
        >
          Skip for now
        </button>
      </form>
    </>
  );
}

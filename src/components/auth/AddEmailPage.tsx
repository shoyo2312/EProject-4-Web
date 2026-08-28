"use client";

import { useRouter } from "next/navigation";

import { AuthShell } from "@/components/auth/AuthShell";
import {
  AuthInput,
  AuthSubmit,
  AuthTitle,
  FieldLabel,
  FormNotice,
  SubtleLink,
} from "@/components/auth/AuthFields";
import { TurnstileWidget } from "@/components/auth/TurnstileWidget";
import { useSession } from "@/components/session/SessionProvider";
import { addEmail } from "@/lib/api/auth";
import { isApiError, messageFor } from "@/lib/api/errors";
import { useTurnstileToken } from "@/lib/auth/use-turnstile-token";
import { addEmailSchema } from "@/lib/forms/schemas";
import { useForm } from "@/lib/forms/use-form";
import { toast } from "@/components/ui/toast";

/**
 * `/signup/add-email` — where a social login lands when the provider handed
 * over no address. Facebook's `email` permission is optional and an account
 * registered with a phone number has none to give, so this is a normal outcome
 * rather than an error.
 *
 * The session is already live and stays usable if the viewer walks away: what
 * an address buys is a way back in. Without one the account cannot reset a
 * password or be reached at all, so losing the Facebook account would mean
 * losing this one. That is what the screen says, and why it can be skipped.
 *
 * The address is not proven here — `POST /auth/email` stores it and mails a
 * code, which the existing OTP screen spends.
 */
export function AddEmailPage() {
  const router = useRouter();
  const { user, isLoading } = useSession();
  const turnstile = useTurnstileToken();

  const form = useForm({
    schema: addEmailSchema,
    initialValues: { email: "" },
    onSubmit: async (values, { setFieldError }) => {
      const email = values.email.trim();
      try {
        await addEmail(email, turnstile.token ?? "");
      } catch (cause) {
        // Someone already holds it. Under the field, because the field is what
        // has to change — and it is the same answer signup gives.
        if (isApiError(cause) && cause.is("EMAIL_ALREADY_EXISTS")) {
          setFieldError("email", messageFor(cause));
          return;
        }
        throw cause;
      } finally {
        turnstile.consume();
      }
      toast.success("Email added. Enter the code we sent to confirm it.");
      router.push(
        `/signup/verify?email=${encodeURIComponent(email)}&next=${encodeURIComponent("/")}`,
      );
    },
  });

  // Nothing to add an address to. `isLoading` is the bootstrap read of `/me`,
  // during which "signed out" is not yet known to be true.
  if (!isLoading && !user) {
    return (
      <AuthShell altPrompt="" altLabel="Log in" altHref="/login">
        <div className="mx-auto mt-16 w-[363px] max-w-[calc(100%-1.5rem)] text-left">
          <AuthTitle>Add your email</AuthTitle>
          <FormNotice>Log in first — this screen updates an account.</FormNotice>
          <SubtleLink href="/login">Go to log in</SubtleLink>
        </div>
      </AuthShell>
    );
  }

  // Reachable by typing the URL, and by a viewer who added an address earlier.
  // `POST /auth/email` would answer `EMAIL_ALREADY_LINKED`, which is a worse
  // way to find out there is nothing to do here.
  if (user?.email) {
    return (
      <AuthShell altPrompt="" altLabel="Log in" altHref="/login">
        <div className="mx-auto mt-16 w-[363px] max-w-[calc(100%-1.5rem)] text-left">
          <AuthTitle>Add your email</AuthTitle>
          <FormNotice>
            This account already has an email address ({user.email}).
          </FormNotice>
          <SubtleLink href="/">Back to the feed</SubtleLink>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell altPrompt="" altLabel="Log in" altHref="/login">
      <div className="mx-auto mt-16 w-[363px] max-w-[calc(100%-1.5rem)] text-left">
        <AuthTitle>Add your email</AuthTitle>

        <p className="mt-2 mb-6 text-[14px] leading-5 text-[var(--tt-text-secondary)]">
          You&rsquo;re signed in, but this account has no email address. Add one
          so you can recover it and receive account updates — otherwise the only
          way in is the account you just used.
        </p>

        <form onSubmit={form.handleSubmit} noValidate>
          <FieldLabel>Email</FieldLabel>
          <AuthInput
            {...form.field("email")}
            type="email"
            placeholder="Email address"
            autoComplete="email"
          />

          {form.formError && <FormNotice error>{form.formError}</FormNotice>}

          <div className="flex justify-center">
            <TurnstileWidget key={turnstile.widgetKey} onVerify={turnstile.setToken} />
          </div>

          <AuthSubmit disabled={form.submitting || !turnstile.token}>
            {form.submitting ? "Sending code…" : "Send code"}
          </AuthSubmit>
        </form>

        <button
          type="button"
          onClick={() => router.push("/")}
          className="mt-4 w-full text-center text-[14px] leading-5 text-[var(--tt-text-secondary)] hover:underline"
        >
          Skip for now
        </button>
      </div>
    </AuthShell>
  );
}

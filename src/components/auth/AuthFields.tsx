"use client";

import Link from "next/link";
import { useId, useState } from "react";

import {
  CaretFilledIcon,
  ChevronLeftIcon,
  EyeIcon,
  EyeOffIcon,
} from "@/components/icons";
import { cn } from "@/lib/utils";

/**
 * The form primitives `/login` and `/signup` share. Both pages build the same
 * 363-wide column out of these, in the order the live forms use them.
 *
 * Measured live (see `docs/research/tiktok.com/AUTH.md`):
 *   title    32/48/700, 8px of air under it
 *   label    15/22.5/600 on the left, the switch link on the right, 10.5 under
 *   input    44 tall, `rgba(255,255,255,.12)`, radius 2, 12px of left padding,
 *            16px text, caret #FE2C55, placeholder `rgba(255,255,255,.34)`,
 *            9px apart
 *   submit   46 tall, radius 4, 16/22/700, 21px above it; disabled is
 *            `rgba(255,255,255,.08)` on `rgba(255,255,255,.34)`, enabled is
 *            #FF3B5C on white
 *   go back  40px under the form, 14/21/600, centred
 */

export function AuthTitle({ children }: { children: React.ReactNode }) {
  return (
    <h1 className="mb-2 text-[32px] leading-12 font-bold text-[var(--tt-text)]">
      {children}
    </h1>
  );
}

/** The field label, with the "use the other method" link opposite it. */
export function FieldLabel({
  children,
  switchTo,
  className,
}: {
  children: React.ReactNode;
  switchTo?: { label: string; href: string };
  /** `/signup` sets its own bottom margin — it runs 5px tighter than login. */
  className?: string;
}) {
  return (
    <div
      className={cn(
        "mb-[10.5px] flex items-baseline justify-between text-[15px] leading-[22.5px] font-semibold text-[var(--tt-text)]",
        className,
      )}
    >
      <span>{children}</span>
      {switchTo && (
        <Link
          href={switchTo.href}
          className="text-[12px] leading-[18px] font-semibold text-[var(--tt-text)] underline decoration-[rgb(255_255_255/0.75)]"
        >
          {switchTo.label}
        </Link>
      )}
    </div>
  );
}

const FIELD_CLASS =
  "h-11 w-full rounded-[2px] border border-transparent bg-white/[0.12] pl-3 text-[16px] text-[var(--tt-text)] caret-[var(--tt-red)] outline-none placeholder:text-[rgb(255_255_255/0.34)]";

/** A field showing a message is outlined, so the eye finds it before the text. */
const FIELD_INVALID_CLASS = "border-[var(--tt-red-active)]";

/**
 * The message under a field. It carries `role="alert"` so a screen reader
 * announces it when it appears on submit, and the input points at it through
 * `aria-describedby` — otherwise the caret lands on a field whose problem is
 * only visible.
 */
export function FieldError({ id, children }: { id: string; children: string }) {
  return (
    <p
      id={id}
      role="alert"
      className="mb-[9px] text-[13px] leading-[18px] text-[var(--tt-red-active)]"
    >
      {children}
    </p>
  );
}

export function AuthInput({
  value,
  onChange,
  placeholder,
  type = "text",
  autoComplete,
  name,
  error,
  ref,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  type?: "text" | "email" | "tel";
  autoComplete?: string;
  name?: string;
  error?: string;
  ref?: React.Ref<HTMLInputElement>;
}) {
  const errorId = useId();

  return (
    <>
      <input
        ref={ref}
        name={name}
        type={type}
        value={value}
        autoComplete={autoComplete}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        className={cn(FIELD_CLASS, !error && "mb-[9px]", error && FIELD_INVALID_CLASS)}
      />
      {error && <FieldError id={errorId}>{error}</FieldError>}
    </>
  );
}

/** The password field, with the eye that toggles the value's visibility. */
export function PasswordInput({
  value,
  onChange,
  placeholder = "Password",
  autoComplete = "current-password",
  name,
  error,
  ref,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  autoComplete?: string;
  name?: string;
  error?: string;
  ref?: React.Ref<HTMLInputElement>;
}) {
  const [shown, setShown] = useState(false);
  const errorId = useId();

  return (
    <>
    <div className={cn("relative", !error && "mb-[9px]")}>
      <input
        ref={ref}
        name={name}
        type={shown ? "text" : "password"}
        value={value}
        autoComplete={autoComplete}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        className={cn(FIELD_CLASS, "pr-13", error && FIELD_INVALID_CLASS)}
      />
      <button
        type="button"
        onClick={() => setShown((was) => !was)}
        aria-label={shown ? "Hide password" : "Show password"}
        className="absolute top-3 right-4 text-[rgb(255_255_255/0.34)]"
      >
        {shown ? (
          <EyeIcon className="h-5 w-5" />
        ) : (
          <EyeOffIcon className="h-5 w-5" />
        )}
      </button>
    </div>
    {error && <FieldError id={errorId}>{error}</FieldError>}
    </>
  );
}

/**
 * The verification-code row: a field that keeps the left half of the radius
 * and a "Send code" button welded to its right edge.
 *
 * The code is real — a six-digit OTP mailed by auth-service, good for 15
 * minutes and single-use. The 60-second countdown on the button is the live
 * site's, and it earns its keep here: the server allows only three sends per
 * address per 15 minutes, so the button has to make people wait.
 *
 * Both screens that use this arrive *after* a code was mailed, so the control
 * is a resend and says so. It is also painted white while it can be pressed:
 * the site's dimmed grey is the disabled colour everywhere else on these forms,
 * and wearing it full time made the only way to get a new code look dead.
 */
export function OtpInput({
  value,
  onChange,
  onResend,
  name,
  error,
  ref,
  /** False on a screen that has not mailed a code yet — then it is a first send. */
  alreadySent = true,
  /** True while a resend needs a solved Turnstile token it doesn't have yet. */
  resendDisabled = false,
}: {
  value: string;
  onChange: (value: string) => void;
  onResend: () => void;
  name?: string;
  error?: string;
  ref?: React.Ref<HTMLInputElement>;
  alreadySent?: boolean;
  resendDisabled?: boolean;
}) {
  const [countdown, setCountdown] = useState(0);
  const errorId = useId();

  const send = () => {
    if (countdown > 0 || resendDisabled) return;
    onResend();
    setCountdown(60);
    const timer = window.setInterval(() => {
      setCountdown((left) => {
        if (left <= 1) window.clearInterval(timer);
        return left - 1;
      });
    }, 1000);
  };

  return (
    <>
    <div className={cn("flex", !error && "mb-[9px]")}>
      <input
        ref={ref}
        name={name}
        inputMode="numeric"
        value={value}
        onChange={(event) =>
          onChange(event.target.value.replace(/\D/g, "").slice(0, 6))
        }
        placeholder="Enter 6-digit code"
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        className={cn(
          FIELD_CLASS,
          "h-[47px] min-w-0 flex-1 rounded-r-none",
          error && FIELD_INVALID_CLASS,
        )}
      />
      <button
        type="button"
        onClick={send}
        disabled={countdown > 0 || resendDisabled}
        className={cn(
          "h-[47px] flex-none rounded-r-[4px] px-4 text-[16px] leading-6 font-semibold transition-colors",
          countdown > 0 || resendDisabled
            ? "cursor-not-allowed bg-white/[0.08] text-[rgb(255_255_255/0.34)]"
            : "cursor-pointer bg-white/[0.12] text-[var(--tt-text)] hover:bg-white/[0.18]",
        )}
      >
        {countdown > 0
          ? `Resend in ${countdown}s`
          : alreadySent
            ? "Resend"
            : "Send code"}
      </button>
    </div>
    {error && <FieldError id={errorId}>{error}</FieldError>}
    {alreadySent && (
      <p className="mb-[9px] text-[12px] leading-[18px] text-[var(--tt-text-secondary)]">
        Didn’t get the code? Check your spam folder, or{" "}
        <button
          type="button"
          onClick={send}
          disabled={countdown > 0}
          className={cn(
            "font-semibold underline",
            countdown > 0
              ? "cursor-not-allowed text-[rgb(255_255_255/0.34)]"
              : "cursor-pointer text-[var(--tt-text)]",
          )}
        >
          {countdown > 0 ? `resend in ${countdown}s` : "send a new one"}
        </button>
        .
      </p>
    )}
    </>
  );
}

/** The one primary button on each form: "Log in", "Next". */
export function AuthSubmit({
  children,
  disabled,
}: {
  children: React.ReactNode;
  disabled: boolean;
}) {
  return (
    <button
      type="submit"
      disabled={disabled}
      className={cn(
        "mt-[21px] h-[46px] w-full rounded-[4px] text-[16px] leading-[22px] font-bold transition-colors",
        disabled
          ? "cursor-not-allowed bg-white/[0.08] text-[rgb(255_255_255/0.34)]"
          : "bg-[var(--tt-red-active)] text-white hover:bg-[var(--tt-red-hover)]",
      )}
    >
      {children}
    </button>
  );
}

/**
 * Server feedback under a form: a rejected login, a rate-limit warning, or a
 * plain statement that a flow is unavailable. The text is always the app's
 * own — the backend's `message` field is English written for logs, and the
 * contracts are explicit that it must not be shown to end users.
 */
export function FormNotice({
  error,
  children,
}: {
  error?: boolean;
  children: React.ReactNode;
}) {
  return (
    <p
      role={error ? "alert" : undefined}
      className={cn(
        "mt-3 text-[14px] leading-5",
        error ? "text-[var(--tt-red-active)]" : "text-[var(--tt-text-secondary)]",
      )}
    >
      {children}
    </p>
  );
}

/** A 12/18/600 link under a field — "Forgot password?", "Log in with password". */
export function SubtleLink({
  children,
  href,
}: {
  children: React.ReactNode;
  href: string;
}) {
  return (
    <div className="h-[21px]">
      <Link
        href={href}
        className="text-[12px] leading-[18px] font-semibold text-[rgb(255_255_255/0.75)]"
      >
        {children}
      </Link>
    </div>
  );
}

/** `.DivBack` — full-width and centred, 40px below the form. */
export function GoBack({ href }: { href: string }) {
  return (
    <Link
      href={href}
      className="mt-10 flex items-center justify-center text-[14px] leading-[21px] font-semibold text-[var(--tt-text)]"
    >
      <ChevronLeftIcon className="mr-1 h-3 w-3" />
      Go back
    </Link>
  );
}

/**
 * `.DivSelector` — one of the three birthday selects, and the country code on
 * the phone forms. A native `<select>` under a styled label, so the caret and
 * the empty-state colour are ours while the popup stays the platform's.
 */
export function Selector({
  label,
  value,
  onChange,
  options,
  placeholder,
  className,
  name,
  invalid,
  ref,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: readonly string[];
  placeholder: string;
  className?: string;
  name?: string;
  /**
   * The three birthday selects share one message under the row, so a select is
   * told it is invalid rather than being handed the text to print.
   */
  invalid?: boolean;
  ref?: React.Ref<HTMLSelectElement>;
}) {
  const id = useId();

  return (
    <div
      className={cn(
        "relative h-11 rounded-[4px] border border-transparent bg-white/[0.12]",
        invalid && FIELD_INVALID_CLASS,
        className,
      )}
    >
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <select
        ref={ref}
        id={id}
        name={name}
        value={value}
        aria-invalid={invalid || undefined}
        onChange={(event) => onChange(event.target.value)}
        className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
      >
        <option value="">{placeholder}</option>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>

      <div
        aria-hidden
        className={cn(
          "pointer-events-none flex h-full items-center justify-between px-3 text-[16px] leading-6",
          value ? "text-[var(--tt-text)]" : "text-[rgb(255_255_255/0.34)]",
        )}
      >
        <span className="truncate">{value || placeholder}</span>
        <CaretFilledIcon className="ml-2 h-3 w-3 flex-none" />
      </div>
    </div>
  );
}

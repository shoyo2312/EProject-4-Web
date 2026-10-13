"use client";

import { useCallback, useRef, useState } from "react";

import {
  ClearCircleIcon,
  EyeClosedIcon,
  EyeIcon,
  RuleCheckIcon,
  WarningIcon,
} from "@/components/icons";
import { passwordRules } from "@/lib/auth/password-rules";
import { cn } from "@/lib/utils";

/**
 * The form primitives of the login/signup modal. Its fields are 48 tall at
 * radius 10, its buttons are pills, and it marks a bad value by turning the
 * text red with a warning glyph rather than outlining the box.
 *
 * Measured live in the modal, 428 × 562 card, 348-wide column:
 *   title    32/38.4/700, 64px from the card top, centred
 *   heading  16/16/600 (16/22 over the birthday row), red asterisk 4px after
 *   input    348 × 48, radius 10, `rgba(255,255,255,.12)`, 12px left padding,
 *            16px text, caret #FE2C55, invalid text rgb(255,76,58)
 *   select   111 × 40, radius 8, same fill, 16/24 text, 16px chevron
 *   button   46 tall pill, 16/22/600; disabled `rgba(255,255,255,.08)` on
 *            `.34`, enabled #FF3B5C on white
 *   code     six 48 × 52 boxes 6px apart, radius 8, `.13`, 20/25/500
 */

export function ModalTitle({
  children,
  className,
}: {
  children: React.ReactNode;
  /** The space under the title differs on every step, as it does live. */
  className?: string;
}) {
  return (
    <h2
      className={cn(
        "mx-3.5 mt-16 text-center text-[32px] leading-[38.4px] font-bold text-[var(--tt-text)]",
        className,
      )}
    >
      {children}
    </h2>
  );
}

/** A field heading, with the live site's red asterisk when it is required. */
export function FieldHeading({
  children,
  required = false,
  htmlFor,
  className,
}: {
  children: React.ReactNode;
  required?: boolean;
  htmlFor?: string;
  className?: string;
}) {
  return (
    <label
      htmlFor={htmlFor}
      className={cn(
        "block text-[16px] leading-4 font-semibold text-[var(--tt-text)]",
        className,
      )}
    >
      {children}
      {required && (
        <span aria-hidden className="ml-1 text-[var(--tt-red-active)]">
          *
        </span>
      )}
    </label>
  );
}

const INPUT_CLASS =
  "h-12 w-full rounded-[10px] bg-white/[0.12] pl-3 text-[16px] leading-4 text-[var(--tt-text)] caret-[var(--tt-red)] outline-none placeholder:text-[rgb(255_255_255/0.34)] aria-invalid:text-[rgb(255_76_58)]";

interface FieldProps {
  value: string;
  onChange: (value: string) => void;
  name?: string;
  error?: string;
  ref?: React.Ref<HTMLInputElement>;
}

export function TextField({
  value,
  onChange,
  name,
  error,
  ref,
  id,
  placeholder,
  type = "text",
  autoComplete,
  autoFocus,
}: FieldProps & {
  id?: string;
  placeholder: string;
  type?: "text" | "email";
  autoComplete?: string;
  autoFocus?: boolean;
}) {
  return (
    <div className="relative">
      <input
        ref={ref}
        id={id}
        name={name}
        type={type}
        value={value}
        autoComplete={autoComplete}
        autoFocus={autoFocus}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        aria-invalid={error ? true : undefined}
        className={cn(INPUT_CLASS, error ? "pr-11" : "pr-4")}
      />
      {error && (
        <WarningIcon className="pointer-events-none absolute top-[17px] right-4 h-3.5 w-3.5 text-[rgb(255_76_58)]" />
      )}
    </div>
  );
}

/**
 * `.DivInputContainer` around a password: the eye at the far right, and once
 * something is typed the clear button before it — plus the warning glyph while
 * the value is `invalid`. The live input's right padding grows with each icon
 * (48 → 96 → 132) so the dots never run under them.
 */
export function PasswordField({
  value,
  onChange,
  name,
  error,
  ref,
  id,
  invalid = false,
  placeholder = "Password",
  autoComplete = "current-password",
  autoFocus,
}: FieldProps & {
  id?: string;
  /** Live rule failures, which mark the field without a submit. */
  invalid?: boolean;
  placeholder?: string;
  autoComplete?: string;
  autoFocus?: boolean;
}) {
  const [shown, setShown] = useState(false);
  const bad = invalid || Boolean(error);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const setRefs = useCallback(
    (node: HTMLInputElement | null) => {
      inputRef.current = node;
      if (typeof ref === "function") ref(node);
      else if (ref) ref.current = node;
    },
    [ref],
  );

  return (
    <div className="relative">
      <input
        ref={setRefs}
        id={id}
        name={name}
        type={shown ? "text" : "password"}
        value={value}
        autoComplete={autoComplete}
        autoFocus={autoFocus}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        aria-invalid={bad ? true : undefined}
        className={cn(
          INPUT_CLASS,
          !value ? "pr-12" : bad ? "pr-[132px]" : "pr-24",
        )}
      />
      <div className="absolute inset-y-0 right-0 flex items-center pr-4">
        {value && bad && (
          <WarningIcon className="mr-[-12px] mb-1.5 h-3.5 w-3.5 text-[rgb(255_76_58)]" />
        )}
        {value && (
          <button
            type="button"
            aria-label="Clear password"
            onClick={() => {
              onChange("");
              inputRef.current?.focus();
            }}
            className="flex h-[22px] items-center pl-3 text-[rgb(255_255_255/0.4)]"
          >
            <ClearCircleIcon className="h-5 w-5" />
          </button>
        )}
        <button
          type="button"
          onClick={() => setShown((was) => !was)}
          aria-label={shown ? "Hide password" : "Show password"}
          className="ml-4 text-[var(--tt-text)] opacity-50"
        >
          {shown ? (
            <EyeIcon className="h-5 w-5" />
          ) : (
            <EyeClosedIcon className="h-5 w-5" />
          )}
        </button>
      </div>
    </div>
  );
}

/** `.BoostedPasswordRule` rows — a dot until the rule is met, then a green tick. */
export function PasswordRuleList({ value }: { value: string }) {
  return (
    <ul className="mt-3">
      {passwordRules(value).map((rule) => (
        <li
          key={rule.label}
          className="my-1 flex items-center gap-1 text-[12px] leading-[15.6px]"
        >
          <span className="flex w-3 flex-none justify-center">
            {rule.met ? (
              <RuleCheckIcon className="h-3 w-3 text-[rgb(11_224_155)]" />
            ) : (
              <span aria-hidden className="text-[var(--tt-text-muted)]">
                •
              </span>
            )}
          </span>
          <span
            className={
              rule.met ? "text-[var(--tt-text)]" : "text-[var(--tt-text-muted)]"
            }
          >
            {rule.label}
            <span className="sr-only">{rule.met ? " — done" : ""}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}

/** `.StyledButton` — the one pill each step submits with. */
export function PillButton({
  children,
  disabled,
  type = "submit",
  onClick,
  className,
}: {
  children: React.ReactNode;
  disabled: boolean;
  type?: "submit" | "button";
  onClick?: () => void;
  className?: string;
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "flex h-[46px] w-full items-center justify-center rounded-full px-2 py-1.5 text-[16px] leading-[22px] font-semibold transition-colors",
        disabled
          ? "cursor-not-allowed bg-white/[0.08] text-[rgb(255_255_255/0.34)]"
          : "bg-[var(--tt-red-active)] text-white hover:bg-[var(--tt-red-hover)]",
        className,
      )}
    >
      {children}
    </button>
  );
}

"use client";

import { useCallback, useRef, useState } from "react";

import {
  CaretDownIcon,
  ClearCircleIcon,
  EyeClosedIcon,
  EyeIcon,
  RuleCheckIcon,
  WarningIcon,
} from "@/components/icons";
import { useDismiss } from "@/hooks/use-dismiss";
import { passwordRules } from "@/lib/auth/password-rules";
import { CODE_LENGTH, enterDigits } from "@/lib/forms/code-digits";
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

/**
 * `.DivSelector` — one of the birthday dropdowns. The live list opens under
 * the box at its width and scrolls, clipped by the card like everything else
 * in it, so it is drawn here rather than left to the platform's popup.
 */
export function Dropdown({
  label,
  value,
  onChange,
  options,
  invalid = false,
  ref,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: readonly string[];
  invalid?: boolean;
  ref?: React.Ref<HTMLButtonElement>;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const close = useCallback(() => setOpen(false), []);
  const setTriggerRef = useCallback(
    (node: HTMLButtonElement | null) => {
      triggerRef.current = node;
      if (typeof ref === "function") ref(node);
      else if (ref) ref.current = node;
    },
    [ref],
  );
  useDismiss(rootRef, open, close);

  const openList = () => {
    setOpen(true);
    // Lands on the chosen option, or the first, so arrows work at once.
    requestAnimationFrame(() => {
      const items = listRef.current?.querySelectorAll<HTMLButtonElement>("button");
      if (!items?.length) return;
      const selected = Math.max(0, options.indexOf(value));
      items[selected].focus();
      items[selected].scrollIntoView({ block: "nearest" });
    });
  };

  const moveFocus = (event: React.KeyboardEvent) => {
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
    event.preventDefault();
    const items = [...(listRef.current?.querySelectorAll<HTMLButtonElement>("button") ?? [])];
    const at = items.indexOf(document.activeElement as HTMLButtonElement);
    const next = event.key === "ArrowDown" ? Math.min(at + 1, items.length - 1) : Math.max(at - 1, 0);
    items[next]?.focus();
  };

  return (
    <div
      ref={rootRef}
      className="relative min-w-0 flex-1"
      onKeyDown={(event) => {
        // Closes the list, not the modal under it: the modal's Escape
        // listener is on the document, so it has to be stopped there.
        if (event.key !== "Escape" || !open) return;
        event.nativeEvent.stopImmediatePropagation();
        close();
        triggerRef.current?.focus();
      }}
    >
      <button
        ref={setTriggerRef}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={value ? `${label}: ${value}` : label}
        onClick={() => (open ? close() : openList())}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown" && !open) {
            event.preventDefault();
            openList();
          }
        }}
        className={cn(
          "flex h-10 w-full items-center justify-between rounded-[8px] bg-white/[0.12] px-3 text-left text-[16px] leading-6",
          value ? "text-[var(--tt-text)]" : "text-[rgb(255_255_255/0.34)]",
          invalid && "text-[rgb(255_76_58)]",
        )}
      >
        <span className="truncate">{value || label}</span>
        <CaretDownIcon
          className={cn(
            "ml-1 h-4 w-4 flex-none text-[var(--tt-text)] transition-transform",
            open && "rotate-180",
          )}
        />
      </button>

      {open && (
        <ul
          ref={listRef}
          role="listbox"
          aria-label={label}
          onKeyDown={moveFocus}
          className="no-scrollbar absolute top-[calc(100%+4px)] left-0 z-10 max-h-[270px] w-full overflow-y-auto rounded-[8px] bg-[#2f2f2f] py-1 shadow-[0_2px_12px_rgba(0,0,0,0.5)]"
        >
          {options.map((option) => (
            <li key={option} role="option" aria-selected={option === value}>
              <button
                type="button"
                onClick={() => {
                  onChange(option);
                  close();
                }}
                className={cn(
                  "flex h-[31px] w-full items-center px-3 text-left text-[16px] text-[var(--tt-text)] outline-none hover:bg-white/[0.06] focus-visible:bg-white/[0.06]",
                  option === value && "font-semibold",
                )}
              >
                {option}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** `.DivCheckboxWrapper` — a 22px box, then 12/16 text at .75. */
export function ConsentCheckbox({
  checked,
  onChange,
  children,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  children: React.ReactNode;
}) {
  return (
    <label className="flex cursor-pointer items-start pl-2">
      <span className="w-8 flex-none">
        <input
          type="checkbox"
          checked={checked}
          onChange={(event) => onChange(event.target.checked)}
          className="block h-[22px] w-[22px] cursor-pointer appearance-none rounded-[2px] border border-[rgb(255_255_255/0.5)] bg-[#121212] checked:border-[var(--tt-red)] checked:bg-[var(--tt-red)]"
        />
      </span>
      <span className="text-[12px] leading-4 text-[rgb(255_255_255/0.75)]">
        {children}
      </span>
    </label>
  );
}

/**
 * `.PinWrapper` — the six code boxes. Typing moves right, Backspace on an empty
 * box moves left and clears it, and a pasted code fills every box at once.
 */
export function CodeBoxes({
  digits,
  onChange,
  disabled = false,
  invalid = false,
  firstRef,
}: {
  digits: string[];
  onChange: (digits: string[]) => void;
  disabled?: boolean;
  invalid?: boolean;
  firstRef?: React.Ref<HTMLInputElement>;
}) {
  const boxes = useRef<(HTMLInputElement | null)[]>([]);

  const focusBox = (index: number) => {
    const box = boxes.current[index];
    box?.focus();
    box?.select();
  };

  return (
    <div className="flex gap-1.5" role="group" aria-label="6-digit code">
      {Array.from({ length: CODE_LENGTH }, (_, index) => (
        <input
          key={index}
          ref={(node) => {
            boxes.current[index] = node;
            if (index !== 0 || !firstRef) return;
            if (typeof firstRef === "function") firstRef(node);
            else firstRef.current = node;
          }}
          value={digits[index]}
          disabled={disabled}
          inputMode="numeric"
          autoComplete={index === 0 ? "one-time-code" : "off"}
          aria-label={`Digit ${index + 1}`}
          aria-invalid={invalid || undefined}
          onFocus={(event) => event.target.select()}
          onChange={(event) => {
            const result = enterDigits(digits, index, event.target.value);
            onChange(result.digits);
            if (result.focus !== index) focusBox(result.focus);
          }}
          onKeyDown={(event) => {
            if (event.key === "Backspace" && !digits[index] && index > 0) {
              event.preventDefault();
              const next = [...digits];
              next[index - 1] = "";
              onChange(next);
              focusBox(index - 1);
            } else if (event.key === "ArrowLeft" && index > 0) {
              event.preventDefault();
              focusBox(index - 1);
            } else if (event.key === "ArrowRight" && index < CODE_LENGTH - 1) {
              event.preventDefault();
              focusBox(index + 1);
            }
          }}
          className={cn(
            "h-[52px] w-12 rounded-[8px] bg-white/[0.13] px-0.5 text-center text-[20px] leading-[25px] font-medium text-[var(--tt-text)] caret-[var(--tt-red)] outline-none disabled:opacity-50",
            invalid && "text-[rgb(255_76_58)]",
          )}
        />
      ))}
    </div>
  );
}

"use client";

import { useRef } from "react";

import { CODE_LENGTH, enterDigits } from "@/lib/forms/code-digits";
import { cn } from "@/lib/utils";

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

"use client";

import { Hash } from "lucide-react";
import { useId, useRef } from "react";

import { codePointLength, fitEdit } from "@/lib/code-points";
import { cn } from "@/lib/utils";

/** The feed's dark input, still used by the story composer. */
export const FIELD =
  "h-11 w-full rounded-[4px] border border-transparent bg-white/[0.12] px-3 text-[15px] text-[var(--tt-text)] caret-[var(--tt-red)] outline-none placeholder:text-[rgb(255_255_255/0.34)]";

type Box = HTMLInputElement & HTMLTextAreaElement;

const TEXT = "w-full bg-transparent text-[16px] leading-[21px] text-black outline-none placeholder:text-black/34";

/**
 * TikTok Studio's caption box, read off the live upload page: 14/500 label,
 * then an 8px-radius `rgba(0,0,0,.05)` box with the text at 16/21 inside 12px
 * of padding. The multiline one grows from 105px and carries the footer row —
 * "# Hashtags" on the left, the 13px `rgba(0,0,0,.34)` counter on the right.
 *
 * Spread a `useForm` field onto it. `max` is video-service's `@MaxCodePoints`
 * limit; the native `maxLength` counts UTF-16 units and would stop a caption
 * of emoji at half of it.
 */
export function CaptionField({
  label,
  value,
  onChange,
  error,
  ref,
  max,
  placeholder,
  multiline,
}: {
  label: string;
  value: string;
  onChange: (next: string) => void;
  error?: string;
  ref?: React.Ref<Box>;
  max: number;
  placeholder?: string;
  multiline?: boolean;
}) {
  const id = useId();
  const local = useRef<Box | null>(null);
  const length = codePointLength(value);

  const shared = {
    id,
    value,
    placeholder,
    ref: (node: Box | null) => {
      local.current = node;
      if (typeof ref === "function") ref(node);
    },
    onChange: (event: React.ChangeEvent<Box>) => onChange(fitEdit(value, event.target.value, max)),
    "aria-invalid": error ? true : undefined,
    "aria-describedby": `${id}-count`,
  } as const;

  const counter = (
    <span
      id={`${id}-count`}
      className={cn("text-[13px] leading-[17px]", length >= max ? "text-[#fe2c55]" : "text-black/34")}
    >
      {length}/{max}
    </span>
  );

  /** Like the live button: drops a `#` at the end and hands the caret back. */
  function addHashtag() {
    const next = fitEdit(value, value && !/\s$/.test(value) ? `${value} #` : `${value}#`, max);
    onChange(next);
    requestAnimationFrame(() => {
      const box = local.current;
      if (!box) return;
      box.focus();
      box.setSelectionRange(next.length, next.length);
    });
  }

  return (
    <div>
      <label htmlFor={id} className="block text-[14px] leading-[21px] font-medium text-black">
        {label}
      </label>
      <div
        className={cn(
          "mt-[11px] rounded-[8px] border bg-black/5 transition-colors",
          error ? "border-[#fe2c55]" : "border-transparent focus-within:border-black/12",
        )}
      >
        {multiline ? (
          <>
            <textarea {...shared} className={cn(TEXT, "block min-h-[115px] resize-none px-3 pt-3 field-sizing-content")} />
            <div className="flex items-center justify-between px-3 pt-2 pb-2.5">
              <button
                type="button"
                onClick={addHashtag}
                className="flex items-center gap-0.5 text-[14px] leading-[18px] font-medium text-black/65 hover:text-black"
              >
                <Hash className="h-4 w-4" strokeWidth={2} />
                Hashtags
              </button>
              {counter}
            </div>
          </>
        ) : (
          <div className="flex items-center gap-3 px-3">
            <input {...shared} className={cn(TEXT, "h-[45px] min-w-0 flex-1")} />
            {counter}
          </div>
        )}
      </div>
      {error && (
        <p role="alert" className="mt-1.5 text-[13px] leading-[17px] text-[#fe2c55]">
          {error}
        </p>
      )}
    </div>
  );
}

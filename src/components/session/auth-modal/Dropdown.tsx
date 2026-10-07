"use client";

import { useCallback, useRef, useState } from "react";

import { CaretDownIcon } from "@/components/icons";
import { useDismiss } from "@/hooks/use-dismiss";
import { cn } from "@/lib/utils";

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

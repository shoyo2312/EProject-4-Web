"use client";

import { useRef } from "react";

import { CloseIcon, SearchIcon } from "@/components/icons";

/**
 * The inbox's search field. A plain text input rather than `type="search"`: that type brings the
 * browser's own clear control, which would sit beside ours. The clear button is ours, keeps focus
 * in the field, and only exists while there is something to clear.
 */
export function ConversationSearch({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="relative mt-3.5 flex h-10 items-center">
      <SearchIcon className="pointer-events-none absolute left-3.5 h-4 w-4 text-[var(--tt-placeholder)]" />
      <input
        ref={inputRef}
        type="text"
        name="conversation-filter"
        inputMode="search"
        enterKeyHint="search"
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") event.preventDefault();
          if (event.key === "Escape" && value) {
            event.preventDefault();
            event.stopPropagation();
            onChange("");
          }
        }}
        placeholder="Search"
        aria-label="Search conversations"
        className="h-10 w-full rounded-[var(--chat-radius-control)] bg-white/[0.06] pr-10 pl-10 text-[15px] text-[var(--tt-text)] caret-[var(--tt-text)] transition-colors placeholder:text-[var(--tt-placeholder)] hover:bg-white/[0.08] focus-visible:bg-white/[0.09] focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-white/40"
      />
      <button
        type="button"
        aria-label="Clear search"
        tabIndex={value ? 0 : -1}
        aria-hidden={value ? undefined : true}
        onMouseDown={(event) => event.preventDefault()}
        onClick={() => {
          onChange("");
          inputRef.current?.focus({ preventScroll: true });
        }}
        className={
          "absolute right-1.5 flex h-8 w-8 items-center justify-center rounded-full text-[var(--chat-meta)] transition-[opacity,background-color] duration-150 hover:bg-white/[0.1] active:bg-white/[0.16] focus-visible:outline-2 focus-visible:outline-white/70 motion-reduce:transition-none " +
          (value ? "opacity-100" : "pointer-events-none opacity-0")
        }
      >
        <CloseIcon className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

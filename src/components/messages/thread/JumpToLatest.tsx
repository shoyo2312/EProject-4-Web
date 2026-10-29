"use client";

import { ArrowDown } from "lucide-react";

import { ChatAvatar } from "@/components/messages/ChatAvatar";
import type { JumpButtonKind } from "@/lib/chat-scroll";
import { cn } from "@/lib/utils";

/**
 * The floating button over the bottom of the history. An arrow while the reader is above the
 * newest message with nothing new; the other person's avatar — in a white ring with a pointer
 * aimed down, like a map pin — once something arrived while they were reading up there.
 *
 * It is one button whose face changes, so an arrival never adds a second one.
 */
export function JumpToLatest({
  kind,
  name,
  avatar,
  onClick,
}: {
  kind: Exclude<JumpButtonKind, "none">;
  name: string;
  avatar: string | undefined;
  onClick: () => void;
}) {
  const label =
    kind === "avatar" ? `New message from ${name}. Scroll to the latest messages` : "Scroll to the latest messages";

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={kind === "avatar" ? `New message from ${name}` : "Latest messages"}
      className={cn(
        "absolute bottom-3 left-1/2 -translate-x-1/2 animate-in fade-in zoom-in-90 duration-150 motion-reduce:animate-none",
        "focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white",
        kind === "avatar"
          ? "flex h-12 w-12 items-center justify-center"
          : "flex h-10 w-10 items-center justify-center rounded-full border border-[var(--chat-line-strong)] bg-[var(--chat-pop)] text-[var(--tt-text)] shadow-[var(--chat-shadow-soft)] transition-colors hover:bg-[var(--chat-active)]",
      )}
    >
      {kind === "avatar" ? (
        <>
          <span aria-hidden className="absolute bottom-[-3px] left-1/2 h-3.5 w-3.5 -translate-x-1/2 rotate-45 rounded-[3px] bg-white" />
          <span aria-hidden className="relative flex h-12 w-12 items-center justify-center rounded-full bg-white p-[3px]">
            <ChatAvatar src={avatar} className="h-full w-full" />
          </span>
        </>
      ) : (
        <ArrowDown aria-hidden className="h-5 w-5" />
      )}
    </button>
  );
}

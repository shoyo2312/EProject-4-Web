"use client";

import { ChatAvatar } from "@/components/messages/ChatAvatar";
import { badgeLabel } from "@/lib/chat-unread";
import { cn } from "@/lib/utils";

/** One conversation as a round avatar on the right edge, with its unread count on the corner. */
export function ChatBubble({
  name,
  avatar,
  unread,
  onOpen,
}: {
  name: string;
  avatar: string | undefined;
  unread: number;
  onOpen: () => void;
}) {
  const count = badgeLabel(unread);
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={count ? `${name}, ${unread} unread` : name}
      title={name}
      className={cn(
        "relative h-12 w-12 flex-none rounded-full border border-[var(--tt-divider)] bg-[var(--tt-sheet-3)]",
        "transition-transform duration-150 hover:scale-105 active:scale-95 motion-reduce:transition-none motion-reduce:hover:scale-100",
        "animate-in fade-in zoom-in-75 duration-150 motion-reduce:animate-none",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white",
      )}
    >
      <ChatAvatar src={avatar} className="h-full w-full" />
      {count && (
        <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-[var(--tt-red)] px-1 text-[10px] leading-none font-bold text-white">
          {count}
        </span>
      )}
    </button>
  );
}

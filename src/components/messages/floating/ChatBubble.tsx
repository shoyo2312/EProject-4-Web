"use client";

import { ChatAvatar } from "@/components/messages/ChatAvatar";
import { CloseIcon } from "@/components/icons";
import { badgeLabel } from "@/lib/chat-unread";
import { cn } from "@/lib/utils";

/**
 * One conversation as a round avatar on the right edge. Its unread count sits on the top-left corner
 * and stays; the close cross on the top-right appears only while the pointer is over the avatar (or
 * the keyboard is on it), and always on a touch screen, which has no hover to reveal it.
 *
 * The cross is a sibling of the avatar button, not inside it: a button cannot hold a button.
 */
export function ChatBubble({
  name,
  avatar,
  unread,
  active,
  panelId,
  onToggle,
  onClose,
}: {
  name: string;
  avatar: string | undefined;
  unread: number;
  /** Its panel is open: pressing the bubble again minimises the panel. */
  active: boolean;
  panelId: string;
  onToggle: () => void;
  /** Hides the bubble until something new arrives in the conversation; nothing is deleted. */
  onClose: () => void;
}) {
  const count = badgeLabel(unread);
  return (
    <div
      className={cn(
        "group/bubble relative h-12 w-12 flex-none",
        "animate-in fade-in zoom-in-75 duration-150 motion-reduce:animate-none",
      )}
    >
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={active}
        aria-controls={active ? panelId : undefined}
        aria-label={count ? `${name}, ${unread} unread` : name}
        title={name}
        className={cn(
          "h-12 w-12 rounded-full bg-[var(--chat-pop)] shadow-[var(--chat-shadow-soft)]",
          "transition-transform duration-150 hover:scale-105 active:scale-95 motion-reduce:transition-none motion-reduce:hover:scale-100",
          "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white",
          active && "ring-2 ring-[var(--tt-red)] ring-offset-2 ring-offset-[var(--chat-thread)]",
        )}
      >
        <ChatAvatar src={avatar} className="h-full w-full" />
      </button>
      {count && (
        <span
          aria-hidden
          className="pointer-events-none absolute -top-1 -left-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-[var(--tt-red)] px-1 text-[10.5px] leading-none font-bold text-white ring-2 ring-[var(--chat-thread)]"
        >
          {count}
        </span>
      )}
      <button
        type="button"
        onClick={onClose}
        aria-label={`Close chat with ${name}`}
        className={cn(
          "absolute -top-1.5 -right-1.5 flex h-5 w-5 items-center justify-center rounded-full",
          "border border-[var(--chat-line-strong)] bg-[var(--chat-pop)] text-[var(--tt-text)] shadow-[var(--chat-shadow-soft)]",
          "opacity-0 transition-opacity duration-100 motion-reduce:transition-none",
          "group-hover/bubble:opacity-100 focus-visible:opacity-100 focus-visible:outline-2 focus-visible:outline-white",
          "[@media(hover:none)]:opacity-100",
        )}
      >
        <CloseIcon className="h-2.5 w-2.5" />
      </button>
    </div>
  );
}

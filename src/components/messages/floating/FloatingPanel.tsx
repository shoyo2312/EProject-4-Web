"use client";

import { Minus } from "lucide-react";
import Link from "next/link";

import { CloseIcon } from "@/components/icons";
import { ChatAvatar } from "@/components/messages/ChatAvatar";
import { useChatUnreadContext } from "@/components/messages/ChatUnreadProvider";
import { ThreadBody } from "@/components/messages/thread/ThreadBody";
import { useChatThread } from "@/hooks/use-chat-thread";
import { otherParticipantId } from "@/lib/chat";
import type { ConversationResponse } from "@/lib/api/conversations";
import { cn } from "@/lib/utils";

const ICON_BUTTON =
  "flex h-8 w-8 items-center justify-center rounded-full text-[var(--chat-meta)] transition-colors hover:bg-[var(--chat-active)] hover:text-[var(--tt-text)] focus-visible:outline-2 focus-visible:outline-white/70";

/**
 * The open thread as a card in the bottom-right corner. It is not a modal: nothing dims the page,
 * and the feed behind it keeps scrolling and playing. `rightClass` steps it clear of the bubble
 * column and of the comment sidebar.
 */
export function FloatingPanel({
  id,
  conversation,
  me,
  rightClass,
  onMinimize,
  onClose,
}: {
  id: string;
  conversation: ConversationResponse;
  me: string;
  rightClass: string;
  onMinimize: () => void;
  onClose: () => void;
}) {
  const unread = useChatUnreadContext();
  const thread = useChatThread(conversation.id, me, unread.markRead);

  const otherId = otherParticipantId(conversation, me);
  const author = unread.authors.get(otherId);
  const name = author?.nickname ?? "…";

  return (
    <section
      id={id}
      role="dialog"
      aria-label={`Chat with ${name}`}
      className={cn(
        "fixed bottom-4 z-[90] flex h-[min(560px,calc(100vh-6rem))] w-[360px] flex-col overflow-hidden",
        "rounded-[var(--chat-radius-surface)] border border-[var(--chat-line)] bg-[var(--chat-thread)] shadow-[var(--chat-shadow-pop)]",
        "animate-in fade-in slide-in-from-bottom-2 duration-150 motion-reduce:animate-none",
        // Never wider than what is left between the side nav and the rail (nav 4.5rem + margin).
        "sm:max-w-[calc(100vw-var(--comment-sidebar-width)-10rem)]",
        "max-sm:left-[4.75rem] max-sm:w-auto",
        rightClass,
      )}
    >
      <header className="flex h-14 flex-none items-center gap-2 border-b border-[var(--chat-line)] pr-2 pl-3">
        <Link
          href={`/@${otherId}`}
          className="flex min-w-0 flex-1 items-center gap-2.5 rounded-[var(--chat-radius-control)] py-1 pr-2 pl-1 transition-colors hover:bg-[var(--chat-hover)] focus-visible:outline-2 focus-visible:outline-white/70"
        >
          <ChatAvatar userId={otherId} src={author?.avatarUrl} className="h-9 w-9" />
          <span className="min-w-0">
            <span className="block truncate text-[15px] leading-5 font-semibold text-[var(--tt-text)]">
              {name}
            </span>
            {author?.handle && (
              <span className="block truncate text-[12px] leading-4 text-[var(--chat-meta)]">
                @{author.handle}
              </span>
            )}
          </span>
        </Link>
        <button type="button" onClick={onMinimize} aria-label="Minimize chat" className={ICON_BUTTON}>
          <Minus className="h-5 w-5" />
        </button>
        <button type="button" onClick={onClose} aria-label="Close chat" className={ICON_BUTTON}>
          <CloseIcon className="h-4 w-4" />
        </button>
      </header>

      <ThreadBody
        conversation={conversation}
        thread={thread}
        me={me}
        name={name}
        avatar={author?.avatarUrl}
      />
    </section>
  );
}

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

import { ChatBubble } from "@/components/messages/floating/ChatBubble";
import { FloatingPanel } from "@/components/messages/floating/FloatingPanel";
import { useChatUnreadContext } from "@/components/messages/ChatUnreadProvider";
import { useSession } from "@/components/session/SessionProvider";
import { isMuted, otherParticipantId } from "@/lib/chat";
import {
  EMPTY_DOCK,
  closeThread,
  dockConversations,
  minimizeThread,
  splitDock,
  toggleThread,
} from "@/lib/floating-chat";
import { cn } from "@/lib/utils";

const PANEL_ID = "floating-chat-panel";

/**
 * Chat while browsing. A message from anyone puts a round avatar on the right edge with the
 * unread count; it never opens a panel by itself. Clicking the avatar opens the thread as a
 * panel and pressing it again minimises the panel (the bubble stays); closing hides the thread
 * until something new arrives.
 *
 * Mounted once in the root layout, so the panel survives navigating between pages. On `/messages`
 * the full inbox takes over and the dock steps out of the way.
 */
export function FloatingChat() {
  const { user } = useSession();
  const pathname = usePathname();
  const unread = useChatUnreadContext();
  const [dock, setDock] = useState(EMPTY_DOCK);

  if (!user || pathname.startsWith("/messages")) return null;

  // A muted conversation does not raise a bubble by itself; the viewer's own opens still stay.
  const items = dockConversations(unread.conversations, unread.byConversation, dock, (conversation) =>
    isMuted(conversation, unread.nowMs),
  );
  const { expanded, shown, hidden } = splitDock(items, dock.expandedId);

  // Two columns beside the comment sidebar, never under it (its width is 0 while shut): the bubble
  // rail (3rem wide, 1rem from the sidebar) and, left of it, the panel (3rem + two 1rem gaps clear).
  // The rail is never hidden, so on a phone the panel stops short of it instead of covering it.
  // Under 640px the sidebar would push both columns beneath the side nav, so they ignore it there.
  const bubbleRight = "right-4 sm:right-[calc(var(--comment-sidebar-width)+1rem)]";
  const panelRight = "right-20 sm:right-[calc(var(--comment-sidebar-width)+5rem)]";

  return (
    <>
      {shown.length > 0 && (
        <div
          className={cn(
            "fixed bottom-4 z-[90] flex flex-col items-center gap-3",
            bubbleRight,
          )}
        >
          {hidden > 0 && (
            <Link
              href="/messages"
              aria-label={`${hidden} more conversations`}
              title="All messages"
              className="flex h-10 w-10 items-center justify-center rounded-full border border-[var(--tt-divider)] bg-[var(--tt-sheet-3)] text-[13px] font-bold text-[var(--tt-text)] transition-colors hover:bg-[var(--tt-shape-neutral-3)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
            >
              +{hidden}
            </Link>
          )}
          {shown.map((conversation) => {
            const author = unread.authors.get(otherParticipantId(conversation, user.userId));
            return (
              <ChatBubble
                key={conversation.id}
                name={author?.nickname ?? "…"}
                avatar={author?.avatarUrl}
                unread={unread.byConversation[conversation.id] ?? 0}
                active={conversation.id === expanded?.id}
                panelId={PANEL_ID}
                onToggle={() => setDock((current) => toggleThread(current, conversation.id))}
                onClose={() =>
                  setDock((current) => closeThread(current, conversation.id, conversation.lastMessageAt))
                }
              />
            );
          })}
        </div>
      )}

      {expanded && (
        <FloatingPanel
          key={expanded.id}
          id={PANEL_ID}
          conversation={expanded}
          me={user.userId}
          rightClass={panelRight}
          onMinimize={() => setDock(minimizeThread)}
          onClose={() => setDock((current) => closeThread(current, expanded.id, expanded.lastMessageAt))}
        />
      )}
    </>
  );
}

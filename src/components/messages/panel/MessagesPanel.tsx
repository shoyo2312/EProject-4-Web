"use client";

import { Maximize2, Minimize2 } from "lucide-react";
import { useEffect, useState } from "react";

import { CloseIcon } from "@/components/icons";
import { ChatAvatar } from "@/components/messages/ChatAvatar";
import { useChatUnreadContext } from "@/components/messages/ChatUnreadProvider";
import { ChatThread } from "@/components/messages/ChatThread";
import { ConversationList } from "@/components/messages/ConversationList";
import { EmptyThread } from "@/components/messages/EmptyThread";
import { MessagesLink } from "@/components/messages/MessagesLink";
import { PanelNavContext, useMessagesPanel } from "@/components/messages/panel/MessagesPanelProvider";
import { RequestList } from "@/components/messages/RequestList";
import { useSession } from "@/components/session/SessionProvider";
import { otherParticipantId } from "@/lib/chat";
import { holdPlayback } from "@/lib/playback-hold";
import { panelReservedWidth, PANEL_THREAD_WIDTH } from "@/lib/messages-panel";
import { cn } from "@/lib/utils";

const EXIT_MS = 320;

/**
 * Messages beside the sidebar, over the feed rather than instead of it. `MessagesPanelSpacer`
 * makes room in the page row (so the feed narrows and keeps playing); the panel itself is fixed
 * next to the rail. Expanded, the same element widens over the content area — the thread inside
 * keeps its place in the tree, so draft, reply and history survive the switch — and the feed
 * underneath is held still instead of playing behind it.
 *
 * Not modal: no backdrop, no focus trap, no scroll lock.
 */
export function MessagesPanel() {
  const { user } = useSession();
  const panel = useMessagesPanel();
  const { requests } = useChatUnreadContext();
  const open = panel.mode !== "closed";
  const expanded = panel.mode === "expanded";

  // Kept mounted through the exit transition, then dropped so a closed panel reads and marks nothing.
  const [mounted, setMounted] = useState(false);
  if (open && !mounted) setMounted(true);
  useEffect(() => {
    if (open) return;
    const timer = window.setTimeout(() => setMounted(false), EXIT_MS);
    return () => window.clearTimeout(timer);
  }, [open]);

  useEffect(() => {
    if (!expanded) return;
    return holdPlayback();
  }, [expanded]);

  if (!user || !panel.available) return null;

  const id = panel.conversationId;
  const showRequests = panel.requests || (id !== null && requests.some((request) => request.id === id));
  const threadOpen = id !== null;

  return (
    <PanelNavContext.Provider value={panel.go}>
      <aside
        id="messages-panel"
        aria-label="Messages"
        inert={!open}
        onKeyDown={(event) => {
          if (event.key !== "Escape" || event.defaultPrevented) return;
          if (expanded) panel.collapse();
          else panel.close();
        }}
        className={cn(
          "fixed inset-y-0 left-18 z-[98] overflow-hidden bg-[var(--chat-list)] transition-[width,opacity] duration-300 ease-[var(--tt-ease)] motion-reduce:transition-none",
          !open && "w-0 border-r-0 opacity-0",
          open && "border-r border-[var(--chat-line)] opacity-100",
          open && !expanded && (threadOpen ? "w-[420px]" : "w-[320px]"),
          expanded && "w-[calc(100vw-4.5rem)]",
        )}
      >
        {mounted && (
          <div
            className={cn(
              "relative flex h-full",
              expanded ? "w-[calc(100vw-4.5rem)]" : threadOpen ? "w-[420px]" : "w-[320px]",
            )}
          >
            <div className={cn("absolute top-4 z-10 flex items-center gap-1", expanded ? "right-20" : "right-3")}>
              <PanelButton
                label={expanded ? "Collapse messages" : "Expand messages"}
                onClick={expanded ? panel.collapse : panel.expand}
              >
                {expanded ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
              </PanelButton>
              <PanelButton label="Close messages" onClick={panel.close}>
                <CloseIcon className="h-4 w-4" />
              </PanelButton>
            </div>

            <div
              className={cn(
                "flex h-full min-w-0 flex-col",
                expanded
                  ? "w-[340px] flex-none border-r border-[var(--chat-line)] tt-1024:w-[300px]"
                  : threadOpen
                    ? "w-16 flex-none border-r border-[var(--chat-line)]"
                    : "w-full",
              )}
            >
              {!expanded && threadOpen ? (
                <AvatarRail openId={id} />
              ) : showRequests ? (
                <RequestList openId={id} inPanel />
              ) : (
                <ConversationList openId={id} inPanel />
              )}
            </div>

            <section
              className={cn(
                "flex h-full min-w-0 flex-1 flex-col bg-[var(--chat-thread)]",
                !threadOpen && !expanded && "hidden",
              )}
            >
              {id ? <ChatThread conversationId={id} showBack={!expanded} /> : expanded ? <EmptyThread /> : null}
            </section>
          </div>
        )}
      </aside>
    </PanelNavContext.Provider>
  );
}

/** Flow-side reservation: narrows the page row so the feed shrinks beside the panel, not under it. */
export function MessagesPanelSpacer() {
  const panel = useMessagesPanel();
  const width = panelReservedWidth(panel);
  return (
    <div
      aria-hidden
      className={cn(
        "h-screen flex-none transition-[width] duration-300 ease-[var(--tt-ease)] motion-reduce:transition-none",
        width === 0 ? "w-0" : width === PANEL_THREAD_WIDTH ? "w-[420px]" : "w-[320px]",
      )}
         />
  );
}

function PanelButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className="flex h-9 w-9 items-center justify-center rounded-full text-[var(--tt-text)] transition-colors hover:bg-[var(--chat-active)] active:bg-white/[0.14] focus-visible:outline-2 focus-visible:outline-white/70"
    >
      {children}
    </button>
  );
}

/** Compact thread view: the people you talk to as avatars, the open one ringed. */
function AvatarRail({ openId }: { openId: string }) {
  const { user } = useSession();
  const { conversations, authors } = useChatUnreadContext();
  const me = user?.userId ?? "";
  return (
    <nav aria-label="Conversations" className="no-scrollbar flex min-h-0 flex-1 flex-col items-center gap-2 overflow-y-auto overscroll-contain py-4">
      {conversations.map((item) => {
        const author = authors.get(otherParticipantId(item, me));
        const active = item.id === openId;
        return (
          <MessagesLink
            key={item.id}
            href={`/messages/${item.id}`}
            aria-label={author?.nickname ?? "Conversation"}
            aria-current={active ? "page" : undefined}
            className={cn(
              "relative flex h-11 w-11 flex-none items-center justify-center rounded-full transition-[box-shadow,background-color] focus-visible:outline-2 focus-visible:outline-white/70",
              active ? "bg-[var(--chat-active)] ring-2 ring-[var(--tt-red)]" : "hover:bg-[var(--chat-hover)]",
            )}
          >
            <ChatAvatar src={author?.avatarUrl} className="h-9 w-9" />
            {item.hasUnread && (
              <span aria-hidden className="absolute top-0.5 right-0.5 h-2.5 w-2.5 rounded-full bg-[var(--tt-red)]" />
            )}
          </MessagesLink>
        );
      })}
    </nav>
  );
}

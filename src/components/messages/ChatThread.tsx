"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { ChevronLeftIcon } from "@/components/icons";
import { MessagesLink } from "@/components/messages/MessagesLink";
import { ChatAvatar } from "@/components/messages/ChatAvatar";
import { useChatUnreadContext } from "@/components/messages/ChatUnreadProvider";
import { ThreadBody, ThreadBodySkeleton } from "@/components/messages/thread/ThreadBody";
import { useSession } from "@/components/session/SessionProvider";
import { Skeleton } from "@/components/ui/skeleton";
import { useChatThread } from "@/hooks/use-chat-thread";
import { resolveAuthor } from "@/lib/api/authors";
import { getConversation, type ConversationResponse } from "@/lib/api/conversations";
import { isIncomingRequest, otherParticipantId } from "@/lib/chat";
import { cn } from "@/lib/utils";

/**
 * Header, history and footer for one conversation. The conversation itself comes from the shared
 * chat state — the inbox, or the message-request box — and from the server when the URL was opened
 * cold (a link, a reload, or a thread just created from a profile).
 */
export function ChatThread({
  conversationId,
  showBack = false,
}: {
  conversationId: string;
  /** Show the way back to the inbox even on a wide screen (the compact panel has no list beside it). */
  showBack?: boolean;
}) {
  const { user } = useSession();
  const { conversations, requests, status, applyConversation } = useChatUnreadContext();
  const [fetched, setFetched] = useState<{
    id: string;
    conversation: ConversationResponse | null;
  } | null>(null);

  const known =
    conversations.find((item) => item.id === conversationId) ??
    requests.find((item) => item.id === conversationId);

  useEffect(() => {
    if (known || status === "loading") return;
    let cancelled = false;
    getConversation(conversationId).then(
      (conversation) => {
        if (cancelled) return;
        applyConversation(conversation);
        setFetched({ id: conversationId, conversation });
      },
      () => {
        if (!cancelled) setFetched({ id: conversationId, conversation: null });
      },
    );
    return () => {
      cancelled = true;
    };
  }, [conversationId, known, status, applyConversation]);

  const conversation = known ?? (fetched?.id === conversationId ? fetched.conversation : undefined);

  if (!user) return null;
  if (conversation === null || (!known && fetched?.id === conversationId && !fetched.conversation)) {
    return <Unavailable text="This conversation isn't available." />;
  }
  if (!conversation) return <ThreadSkeleton />;

  return <OpenThread key={conversation.id} conversation={conversation} me={user.userId} showBack={showBack} />;
}

function OpenThread({
  conversation,
  me,
  showBack,
}: {
  conversation: ConversationResponse;
  me: string;
  showBack: boolean;
}) {
  const { authors, markRead } = useChatUnreadContext();
  const thread = useChatThread(conversation.id, me, markRead);
  const otherId = otherParticipantId(conversation, me);
  const [fallback, setFallback] = useState<{ nickname: string; avatarUrl: string } | null>(null);
  const author = authors.get(otherId);
  const request = isIncomingRequest(conversation, me);

  useEffect(() => {
    if (author) return;
    let cancelled = false;
    resolveAuthor(otherId).then((resolved) => {
      if (!cancelled) setFallback(resolved);
    });
    return () => {
      cancelled = true;
    };
  }, [author, otherId]);

  const name = author?.nickname ?? fallback?.nickname ?? "…";
  const avatar = author?.avatarUrl ?? fallback?.avatarUrl;

  return (
    <div className="flex h-full min-h-0 flex-col animate-in fade-in duration-150 motion-reduce:animate-none">
      <header className="flex h-[68px] flex-none items-center gap-3 border-b border-[var(--chat-line)] pr-20 pl-5 tt-768:h-14 tt-768:pr-14 tt-768:pl-2">
        <MessagesLink
          href={request ? "/messages/requests" : "/messages"}
          aria-label={request ? "Back to message requests" : "Back to messages"}
          className={cn(
            "h-10 w-10 flex-none items-center justify-center rounded-full text-[var(--tt-text)] transition-colors hover:bg-[var(--chat-active)] focus-visible:outline-2 focus-visible:outline-white/70",
            showBack ? "flex" : "hidden tt-768:flex",
          )}
        >
          <ChevronLeftIcon className="h-5 w-5" />
        </MessagesLink>
        <Link
          href={`/@${otherId}`}
          className="flex min-w-0 items-center gap-3 rounded-[var(--chat-radius-control)] py-1 pr-3 transition-colors hover:bg-[var(--chat-hover)] focus-visible:outline-2 focus-visible:outline-white/70"
        >
          <ChatAvatar userId={otherId} src={avatar} className="h-10 w-10 tt-768:h-9 tt-768:w-9" />
          <span className="min-w-0">
            <span className="block truncate text-[16px] leading-5 font-semibold tracking-[-0.005em] text-[var(--tt-text)]">
              {name}
            </span>
            {author?.handle && (
              <span className="block truncate text-[12.5px] leading-4 text-[var(--chat-meta)]">
                @{author.handle}
              </span>
            )}
          </span>
        </Link>
      </header>

      <ThreadBody conversation={conversation} thread={thread} me={me} name={name} avatar={avatar} />
    </div>
  );
}

function Unavailable({ text }: { text: string }) {
  return (
    <div className="flex h-full flex-col items-center justify-center px-6 text-center">
      <p className="text-[16px] font-semibold text-[var(--tt-text)]">{text}</p>
      <MessagesLink
        href="/messages"
        className="mt-4 inline-flex h-9 items-center rounded-full bg-white/[0.08] px-5 text-[14px] font-semibold text-[var(--tt-text)] transition-colors hover:bg-white/[0.14] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/70"
      >
        Back to messages
      </MessagesLink>
    </div>
  );
}

function ThreadSkeleton() {
  return (
    <div className="flex h-full flex-col">
      <div className="flex h-[68px] flex-none items-center gap-3 border-b border-[var(--chat-line)] pl-5">
        <Skeleton className="h-10 w-10 rounded-full" />
        <Skeleton className="h-4 w-32" />
      </div>
      <ThreadBodySkeleton />
    </div>
  );
}

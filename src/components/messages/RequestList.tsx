"use client";

import { ChevronLeftIcon } from "@/components/icons";
import { MessagesLink } from "@/components/messages/MessagesLink";
import { useChatUnreadContext } from "@/components/messages/ChatUnreadProvider";
import {
  ConversationRow,
  ListNotice,
  ListSkeleton,
} from "@/components/messages/ConversationList";
import { useSession } from "@/components/session/SessionProvider";
import { otherParticipantId } from "@/lib/chat";
import { cn } from "@/lib/utils";

/**
 * Message requests: the conversations strangers (people the viewer does not follow back) opened,
 * each with the one message they were allowed. Opening a row reads it; it stays here until the
 * viewer accepts it, which moves it to the inbox, or deletes it, which removes it from here.
 */
export function RequestList({ openId, inPanel = false }: { openId: string | null; inPanel?: boolean }) {
  const { user } = useSession();
  const { requests, authors, status, reload } = useChatUnreadContext();
  const me = user?.userId ?? "";

  return (
    <>
      <header className={cn("flex flex-none items-center gap-2 px-3 pb-3", inPanel ? "pt-5 pr-24" : "pt-16 tt-768:pt-4")}>
        <MessagesLink
          href="/messages"
          aria-label="Back to messages"
          className="flex h-9 w-9 flex-none items-center justify-center rounded-full bg-[var(--tt-field)] text-[var(--tt-text)] transition-colors hover:bg-[var(--tt-shape-neutral-3)] focus-visible:outline-2 focus-visible:outline-white/60"
        >
          <ChevronLeftIcon className="h-4 w-4" />
        </MessagesLink>
        <h1 className="text-[22px] leading-7 font-bold text-[var(--tt-text)]">Message requests</h1>
      </header>

      <nav aria-label="Message requests" className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 pb-4">
        {status === "loading" ? (
          <ListSkeleton />
        ) : status === "error" && requests.length === 0 ? (
          <ListNotice
            title="Couldn't load message requests"
            action={
              <button
                type="button"
                onClick={reload}
                className="mt-3 h-9 rounded-full bg-white/[0.08] px-5 text-[14px] font-semibold text-[var(--tt-text)] transition-colors hover:bg-white/[0.14] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/60"
              >
                Try again
              </button>
            }
          />
        ) : requests.length === 0 ? (
          <ListNotice
            icon
            title="No message requests"
            body="When someone you don't follow back messages you, it will show up here."
          />
        ) : (
          <ul>
            {requests.map((item) => (
              <li key={item.id}>
                <ConversationRow
                  item={item}
                  author={authors.get(otherParticipantId(item, me))}
                  me={me}
                  active={item.id === openId}
                  unreadAsCount
                />
              </li>
            ))}
          </ul>
        )}
      </nav>
    </>
  );
}

"use client";

import Link from "next/link";

import { ChevronLeftIcon } from "@/components/icons";
import { useChatUnreadContext } from "@/components/messages/ChatUnreadProvider";
import {
  ConversationRow,
  ListNotice,
  ListSkeleton,
} from "@/components/messages/ConversationList";
import { useSession } from "@/components/session/SessionProvider";
import { otherParticipantId } from "@/lib/chat";

/**
 * Message requests: the conversations strangers (people the viewer does not follow back) opened,
 * each with the one message they were allowed. Opening a row reads it; it stays here until the
 * viewer accepts it, which moves it to the inbox, or deletes it, which removes it from here.
 */
export function RequestList({ openId }: { openId: string | null }) {
  const { user } = useSession();
  const { requests, authors, status, reload } = useChatUnreadContext();
  const me = user?.userId ?? "";

  return (
    <>
      <header className="flex flex-none items-center gap-2 px-3 pt-16 pb-3 tt-768:pt-4">
        <Link
          href="/messages"
          aria-label="Back to messages"
          className="flex h-9 w-9 flex-none items-center justify-center rounded-full bg-[var(--tt-field)] text-[var(--tt-text)] transition-colors hover:bg-[var(--tt-shape-neutral-3)] focus-visible:outline-2 focus-visible:outline-white/60"
        >
          <ChevronLeftIcon className="h-4 w-4" />
        </Link>
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
                className="mt-3 h-9 rounded-full bg-[var(--tt-field)] px-5 text-[14px] font-semibold text-[var(--tt-text)] transition-colors hover:bg-[var(--tt-shape-neutral-3)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/60"
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

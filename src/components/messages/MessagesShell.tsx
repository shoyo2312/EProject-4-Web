"use client";

import { useSelectedLayoutSegment } from "next/navigation";

import { useChatUnreadContext } from "@/components/messages/ChatUnreadProvider";
import { ConversationList } from "@/components/messages/ConversationList";
import { RequestList } from "@/components/messages/RequestList";
import { useSession } from "@/components/session/SessionProvider";
import { cn } from "@/lib/utils";

const REQUESTS_SEGMENT = "requests";

/**
 * `/messages` — Instagram Direct's two panes in Messages' dress: the inbox on the left, the open
 * thread (the route's `children`) on the right. Below 768px the two take turns, keyed off whether
 * the URL names a thread, so the browser's Back button is also the way out of a conversation.
 *
 * The left pane is the message-request box while the URL is `/messages/requests` or names a
 * request still waiting on the viewer, and the inbox otherwise — so accepting a request moves the
 * pane back to the inbox by itself. The state both panes read lives above the routes, in
 * `ChatUnreadProvider`, which is also what the floating chat reads.
 */
export function MessagesShell({ children }: { children: React.ReactNode }) {
  const { user, isLoading, openLogin } = useSession();
  const segment = useSelectedLayoutSegment();
  const { requests } = useChatUnreadContext();

  const openId = segment && segment !== REQUESTS_SEGMENT ? segment : null;
  const showRequests =
    segment === REQUESTS_SEGMENT || (openId !== null && requests.some((request) => request.id === openId));

  if (!user) {
    return (
      <main className="flex h-screen flex-1 items-center justify-center px-6">
        {isLoading ? null : (
          <div className="flex max-w-xs flex-col items-center text-center">
            <h1 className="text-[22px] leading-7 font-bold text-[var(--tt-text)]">Messages</h1>
            <p className="mt-2 text-[15px] leading-5 text-[var(--tt-text-muted)]">
              Log in to message the people you follow.
            </p>
            <button
              type="button"
              onClick={openLogin}
              className="mt-5 h-10 rounded-full bg-[var(--tt-red)] px-6 text-[15px] font-semibold text-white transition-colors hover:bg-[var(--tt-red-hover)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
            >
              Log in
            </button>
          </div>
        )}
      </main>
    );
  }

  return (
    <main className="flex h-screen min-w-0 flex-1 overflow-hidden">
      <aside
        className={cn(
          "flex h-full w-[340px] flex-none flex-col border-r border-[var(--chat-line)] bg-[var(--chat-list)] tt-1024:w-[300px]",
          "tt-768:w-full tt-768:border-r-0",
          openId && "tt-768:hidden",
        )}
      >
        {showRequests ? <RequestList openId={openId} /> : <ConversationList openId={openId} />}
      </aside>

      <section className={cn("flex h-full min-w-0 flex-1 flex-col bg-[var(--chat-thread)]", !openId && "tt-768:hidden")}>
        {children}
      </section>
    </main>
  );
}

"use client";

import { BellOff, MessagesSquare, Pin } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { ChatAvatar } from "@/components/messages/ChatAvatar";
import { ConversationMenu } from "@/components/messages/ConversationMenu";
import { useChatUnreadContext } from "@/components/messages/ChatUnreadProvider";
import { useSession } from "@/components/session/SessionProvider";
import { MessagesIcon, SearchIcon } from "@/components/icons";
import { Skeleton } from "@/components/ui/skeleton";
import { useHoverCapable } from "@/hooks/use-hover-capable";
import type { ConversationResponse } from "@/lib/api/conversations";
import { formatListTime, isMuted, messagePreview, otherParticipantId } from "@/lib/chat";
import { cn } from "@/lib/utils";
import type { Author } from "@/types/tiktok";

/** Instagram Direct's rail: title, a search over the people already here, then one row per thread. */
export function ConversationList({ openId }: { openId: string | null }) {
  const { user } = useSession();
  const { conversations: items, authors, status, reload, requestSummary } = useChatUnreadContext();
  const [query, setQuery] = useState("");
  const me = user?.userId ?? "";

  const needle = query.trim().toLowerCase();
  const visible = needle
    ? items.filter((item) => {
        const author = authors.get(otherParticipantId(item, me));
        return (
          author !== undefined &&
          `${author.nickname} ${author.handle ?? ""}`.toLowerCase().includes(needle)
        );
      })
    : items;

  return (
    <>
      <header className="flex-none px-5 pt-16 pb-2 tt-768:pt-5">
        <h1 className="text-[22px] leading-7 font-bold tracking-[-0.01em] text-[var(--tt-text)]">Messages</h1>
        <label className="relative mt-3.5 flex h-10 items-center">
          <SearchIcon className="pointer-events-none absolute left-3.5 h-4 w-4 text-[var(--tt-placeholder)]" />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search"
            aria-label="Search conversations"
            className="h-10 w-full rounded-[var(--chat-radius-control)] bg-white/[0.06] pr-3 pl-10 text-[15px] text-[var(--tt-text)] transition-colors placeholder:text-[var(--tt-placeholder)] hover:bg-white/[0.08] focus-visible:bg-white/[0.09] focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-white/40"
          />
        </label>
      </header>

      <nav aria-label="Conversations" className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-2.5 pb-4">
        {requestSummary.pending > 0 && !needle && (
          <MessageRequestsEntry pending={requestSummary.pending} unread={requestSummary.unread} />
        )}

        {status === "loading" ? (
          <ListSkeleton />
        ) : status === "error" ? (
          <ListNotice
            title="Couldn't load messages"
            action={
              <button
                type="button"
                onClick={reload}
                className="mt-4 h-9 rounded-full bg-white/[0.08] px-5 text-[14px] font-semibold text-[var(--tt-text)] transition-colors hover:bg-white/[0.14] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/70"
              >
                Try again
              </button>
            }
          />
        ) : items.length === 0 ? (
          requestSummary.pending > 0 ? null : (
            <ListNotice
              icon
              title="No messages yet"
              body="Open someone's profile and tap Message to start a conversation."
            />
          )
        ) : visible.length === 0 ? (
          <ListNotice title="No matches" body={`Nobody here matches "${query.trim()}".`} />
        ) : (
          <ul>
            {visible.map((item) => (
              <li key={item.id}>
                <ConversationRow
                  item={item}
                  author={authors.get(otherParticipantId(item, me))}
                  me={me}
                  active={item.id === openId}
                  withMenu
                />
              </li>
            ))}
          </ul>
        )}
      </nav>
    </>
  );
}

/**
 * The door to the request box, shown only while something is waiting in it. `pending` is how many
 * requests need an answer (the subtitle); the badge is how many of them have not been opened.
 */
function MessageRequestsEntry({ pending, unread }: { pending: number; unread: number }) {
  return (
    <Link
      href="/messages/requests"
      className="mb-1 flex items-center gap-3 rounded-[var(--chat-radius-control)] px-3 py-2.5 transition-colors hover:bg-[var(--chat-hover)] focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-white/70"
    >
      <span className="flex h-12 w-12 flex-none items-center justify-center rounded-full bg-white/[0.08] text-[var(--tt-text)]">
        <MessagesSquare aria-hidden className="h-5 w-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[15px] leading-5 font-semibold text-[var(--tt-text)]">
          Message requests
        </span>
        <span className="block truncate text-[13.5px] leading-[18px] text-[var(--chat-meta)]">
          You have {pending} {pending === 1 ? "request" : "requests"}
        </span>
      </span>
      {unread > 0 && <CountBadge count={unread} label={`${unread} unread`} />}
    </Link>
  );
}

export function CountBadge({ count, label }: { count: number; label: string }) {
  return (
    <span
      role="img"
      aria-label={label}
      className="flex h-[18px] min-w-[18px] flex-none items-center justify-center rounded-full bg-[var(--tt-red)] px-1.5 text-[11px] leading-none font-bold text-white"
    >
      {count > 99 ? "99+" : count}
    </span>
  );
}

export function ConversationRow({
  item,
  author,
  me,
  active,
  unreadAsCount = false,
  withMenu = false,
}: {
  item: ConversationResponse;
  author: Author | undefined;
  me: string;
  active: boolean;
  /** A message request holds one message, so its unread mark is the number 1 rather than a dot. */
  unreadAsCount?: boolean;
  /** The "…" with mute, pin, block and delete: the inbox has it, the request box does not. */
  withMenu?: boolean;
}) {
  const preview = messagePreview(item, me);
  const { nowMs } = useChatUnreadContext();
  const hover = useHoverCapable();
  const [menuOpen, setMenuOpen] = useState(false);
  const muted = isMuted(item, nowMs);
  const pinned = item.pinnedAt !== null;
  const name = author?.nickname ?? "this account";
  // Where there is no hover the button is always there, so the row leaves room for it; with a
  // pointer it appears over the time, which steps aside.
  const buttonShown = withMenu && (menuOpen || !hover);

  const link = (
    <Link
      href={`/messages/${item.id}`}
      aria-current={active ? "page" : undefined}
      className={cn(
        "relative flex items-center gap-3 rounded-[var(--chat-radius-control)] px-3 py-2.5 transition-colors",
        "hover:bg-[var(--chat-hover)] focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-white/70",
        (active || menuOpen) && "bg-[var(--chat-active)] hover:bg-[var(--chat-active)]",
        // The open row is told apart by a slim accent edge as well as the lighter surface.
        active && "before:absolute before:top-3 before:bottom-3 before:left-0 before:w-[3px] before:rounded-full before:bg-[var(--tt-red)]",
        withMenu && !hover && "pr-12",
      )}
    >
      <ChatAvatar src={author?.avatarUrl} className="h-12 w-12" />

      <span className="min-w-0 flex-1">
        <span className="flex items-baseline gap-2">
          <span
            className={cn(
              "truncate text-[15px] leading-5 text-[var(--tt-text)]",
              item.hasUnread ? "font-bold" : "font-semibold",
            )}
          >
            {author?.nickname ?? "…"}
          </span>
          {item.lastMessageAt && (
            <time
              dateTime={item.lastMessageAt}
              className={cn(
                "ml-auto flex-none text-[12px] leading-4 text-[var(--chat-meta)]",
                withMenu && hover && "group-focus-within/row:invisible group-hover/row:invisible",
                withMenu && hover && menuOpen && "invisible",
              )}
            >
              {formatListTime(item.lastMessageAt)}
            </time>
          )}
        </span>
        <span className="flex items-center gap-2">
          <span
            className={cn(
              "truncate text-[13.5px] leading-[18px]",
              item.hasUnread
                ? "font-semibold text-[var(--tt-text)]"
                : "text-[var(--chat-meta)]",
            )}
          >
            {preview}
          </span>
          {pinned && <Pin aria-label="Pinned" className="ml-auto h-3 w-3 flex-none -rotate-45 text-[var(--chat-meta)]" />}
          {muted && <BellOff aria-label="Notifications muted" className={cn("h-3 w-3 flex-none text-[var(--chat-meta)]", !pinned && "ml-auto")} />}
          {item.hasUnread &&
            (unreadAsCount ? (
              <span className="ml-auto flex-none">
                <CountBadge count={1} label="Unread" />
              </span>
            ) : (
              <span
                role="img"
                aria-label="Unread"
                className={cn("h-2.5 w-2.5 flex-none rounded-full bg-[var(--tt-red)]", !pinned && !muted && "ml-auto")}
              />
            ))}
        </span>
      </span>
    </Link>
  );

  if (!withMenu) return link;

  return (
    <div className="group/row relative">
      {link}
      <ConversationMenu
        item={item}
        name={name}
        otherId={otherParticipantId(item, me)}
        active={active}
        open={menuOpen}
        onOpenChange={setMenuOpen}
        className={cn(
          "absolute top-2.5 right-3",
          !buttonShown && "opacity-0 focus-visible:opacity-100 group-focus-within/row:opacity-100 group-hover/row:opacity-100",
        )}
      />
    </div>
  );
}

export function ListSkeleton() {
  return (
    <div aria-hidden className="space-y-1">
      {Array.from({ length: 7 }, (_, i) => (
        <div key={i} className="flex items-center gap-3 px-3 py-2.5">
          <Skeleton className="h-12 w-12 flex-none rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3.5 w-1/3" />
            <Skeleton className="h-3 w-3/4" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function ListNotice({
  title,
  body,
  icon,
  action,
}: {
  title: string;
  body?: string;
  icon?: boolean;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center px-8 pt-16 text-center">
      {icon && (
        <span className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-white/[0.06]">
          <MessagesIcon className="h-7 w-7 text-[var(--chat-meta)]" />
        </span>
      )}
      <p className="text-[16px] leading-5 font-semibold text-[var(--tt-text)]">{title}</p>
      {body && <p className="mt-1.5 text-[14px] leading-[21px] text-[var(--chat-meta)]">{body}</p>}
      {action}
    </div>
  );
}

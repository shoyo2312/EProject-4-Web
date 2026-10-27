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
      <header className="flex-none px-5 pt-16 pb-3 tt-768:pt-5">
        <h1 className="text-[24px] leading-[30px] font-bold text-[var(--tt-text)]">Messages</h1>
        <label className="relative mt-4 flex h-9 items-center">
          <SearchIcon className="pointer-events-none absolute left-3 h-4 w-4 text-[var(--tt-placeholder)]" />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search"
            aria-label="Search conversations"
            className="h-9 w-full rounded-[10px] bg-[var(--tt-field)] pr-3 pl-9 text-[15px] text-[var(--tt-text)] placeholder:text-[var(--tt-placeholder)] focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-white/60"
          />
        </label>
      </header>

      <nav aria-label="Conversations" className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 pb-4">
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
                className="mt-3 h-9 rounded-full bg-[var(--tt-field)] px-5 text-[14px] font-semibold text-[var(--tt-text)] transition-colors hover:bg-[var(--tt-shape-neutral-3)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/60"
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
      className="mb-1 flex items-center gap-3 rounded-[12px] px-3 py-2.5 transition-colors hover:bg-[var(--tt-field)] focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-white/60"
    >
      <span className="flex h-12 w-12 flex-none items-center justify-center rounded-full bg-[var(--tt-shape-neutral-3)] text-[var(--tt-text)]">
        <MessagesSquare aria-hidden className="h-5 w-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[15px] leading-5 font-semibold text-[var(--tt-text)]">
          Message requests
        </span>
        <span className="block truncate text-[14px] leading-[18px] text-[var(--tt-text-muted)]">
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
      className="flex h-4 min-w-4 flex-none items-center justify-center rounded-full bg-[var(--tt-red)] px-1 text-[10px] leading-none font-bold text-white"
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
        "flex items-center gap-3 rounded-[12px] px-3 py-2.5 transition-colors",
        "hover:bg-[var(--tt-field)] focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-white/60",
        (active || menuOpen) && "bg-[var(--tt-field)]",
        withMenu && !hover && "pr-12",
      )}
    >
      <ChatAvatar src={author?.avatarUrl} className="h-12 w-12" />

      <span className="min-w-0 flex-1">
        <span className="flex items-baseline gap-2">
          <span
            className={cn(
              "truncate text-[15px] leading-5 text-[var(--tt-text)]",
              item.hasUnread ? "font-bold" : "font-medium",
            )}
          >
            {author?.nickname ?? "…"}
          </span>
          {pinned && <Pin aria-label="Pinned" className="h-3 w-3 flex-none -rotate-45 self-center text-[var(--tt-text-muted)]" />}
          {muted && <BellOff aria-label="Notifications muted" className="h-3 w-3 flex-none self-center text-[var(--tt-text-muted)]" />}
          {item.lastMessageAt && (
            <time
              dateTime={item.lastMessageAt}
              className={cn(
                "ml-auto flex-none text-[12px] leading-4 text-[var(--tt-text-muted)]",
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
              "truncate text-[14px] leading-[18px]",
              item.hasUnread
                ? "font-semibold text-[var(--tt-text)]"
                : "text-[var(--tt-text-muted)]",
            )}
          >
            {preview}
          </span>
          {item.hasUnread &&
            (unreadAsCount ? (
              <span className="ml-auto flex-none">
                <CountBadge count={1} label="Unread" />
              </span>
            ) : (
              <span
                role="img"
                aria-label="Unread"
                className="ml-auto h-2.5 w-2.5 flex-none rounded-full bg-[var(--tt-red)]"
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
    <div className="flex flex-col items-center px-6 pt-16 text-center">
      {icon && <MessagesIcon className="mb-3 h-10 w-10 text-[var(--tt-text-muted)]" />}
      <p className="text-[16px] leading-5 font-semibold text-[var(--tt-text)]">{title}</p>
      {body && <p className="mt-1 text-[14px] leading-5 text-[var(--tt-text-muted)]">{body}</p>}
      {action}
    </div>
  );
}

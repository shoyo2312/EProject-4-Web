"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { CloseIcon } from "@/components/icons";
import {
  NOTIFICATION_FILTERS,
  groupByDay,
  type NotificationInbox,
} from "@/hooks/use-notifications";
import { DEFAULT_AVATAR } from "@/lib/api/adapters";
import type { NotificationResponse } from "@/lib/api/notifications";
import type { UserProfileResponse, VideoResponse } from "@/lib/api/types";
import { formatRelativeTime } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * `.DivDrawerContainer` — extracted verbatim:
 *
 *   --drawer-animation-duration: 400ms;
 *   --drawer-animation-easing: ease;
 *   width: var(--drawer-content-width, 20rem);   → 320px
 *   height: 100vh; position: fixed; top: 0;
 *   inset-inline-start: 4.5rem;                  → 72px, beside the collapsed nav
 *   background-color: var(--ui-page-flat-1);
 *   z-index: 99;
 *   border-inline: 1px solid rgba(255,255,255,.12);
 *   overscroll-behavior: contain;
 *   visibility: hidden; pointer-events: none;
 *
 *   .drawer-enter        { transform: translateX(-24rem); opacity: .3 }
 *   .drawer-enter-active { transform: translateX(0);      opacity: 1  }
 *   .drawer-exit         { transform: translateX(0);      opacity: 1  }
 *   .drawer-exit-active  { transform: translateX(-24rem); opacity: .3;
 *                          transition: transform 400ms ease, opacity 400ms ease }
 *
 * Unlike the comment sidebar this **overlays** the feed — it is `position:
 * fixed`, and the 240px sidebar placeholder does not change. Verified live: the
 * article stayed at x=240, width 1616px, padding 64/176 with the drawer both
 * open and closed. The only thing that moves is the fixed sidebar itself,
 * which collapses 15rem → 4.5rem.
 *
 * `visibility` is included in the transition on purpose: it flips to visible
 * immediately on open but holds until the end of the 400ms on close, so the
 * panel does not disappear mid-slide.
 */
export function ActivityDrawer({
  open,
  inbox,
  onClose,
}: {
  open: boolean;
  inbox: NotificationInbox;
  onClose: () => void;
}) {
  const router = useRouter();
  const [filter, setFilter] = useState<string>(NOTIFICATION_FILTERS[0].label);

  const groups = useMemo(() => {
    const selected = NOTIFICATION_FILTERS.find((chip) => chip.label === filter);
    const types = selected?.types ?? null;
    const visible = types
      ? inbox.items.filter((item) =>
          (types as readonly string[]).includes(item.type),
        )
      : inbox.items;
    return groupByDay(visible);
  }, [inbox.items, filter]);

  /**
   * Every route the drawer hands off to closes it on the way out: it is a fixed
   * overlay pinned beside the nav, so left open it sits on top of the profile
   * or the video the click just asked for.
   */
  const navigate = (path: string) => {
    onClose();
    router.push(path);
  };

  /**
   * Follow the notification to whatever it is about, and mark it read on the
   * way — opening it is the read, the same as the live site.
   */
  const openNotification = (item: NotificationResponse) => {
    inbox.markRead(item.id);
    if (!item.referenceId) return;

    // A NEW_FOLLOWER's referenceId is the follower's userId, and `/@{id}` is a
    // profile URL in its own right (see ProfileRouter) — no lookup needed to
    // turn it into a handle first.
    if (item.type === "NEW_FOLLOWER") {
      navigate(`/@${item.referenceId}`);
      return;
    }
    if (item.type === "SYSTEM") return;
    navigate(`/video/${item.referenceId}`);
  };

  /**
   * The username itself is a second, narrower target than the row: it always
   * goes to the actor's profile, even on a LIKE/COMMENT/SHARE row where the
   * row's own click goes to the video instead. Uses the handle when `actors`
   * has already resolved one — it is the nicer URL — and the id otherwise,
   * which the profile route answers just the same.
   */
  const openActor = (item: NotificationResponse, actor: UserProfileResponse | undefined) => {
    inbox.markRead(item.id);
    const handle = actor?.username ?? item.actorId;
    if (!handle) return;
    navigate(`/@${handle}`);
  };

  // Not extracted from the live site — a baseline affordance for a fixed
  // overlay that would otherwise only be dismissable by re-clicking the nav.
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  return (
    <div
      aria-hidden={!open}
      className={cn(
        // Under the sidebar's animation cover — see `SearchDrawer`.
        "fixed top-0 z-[1] h-screen w-80 overscroll-contain bg-[var(--tt-page)]",
        "left-18 border-x border-[var(--tt-divider)]",
        // `transform`, not Tailwind's `translate-x-*`: in v4 those compile to the
        // `translate` property, which `transition-[transform]` does not cover —
        // the slide snapped instantly while opacity eased.
        "transition-[transform,opacity,visibility] duration-[400ms] ease-[ease]",
        open
          ? "visible opacity-100 [transform:translateX(0)]"
          : "invisible opacity-30 [transform:translateX(-24rem)] [pointer-events:none]",
      )}
    >
      {/* `.DivDrawerCloseButtonContainer` — absolute, top 1.5rem, end 1rem.
          The button itself is 28×28, rgba(255,255,255,.13), radius 999px. */}
      <div className="absolute end-4 top-6 z-[1] flex items-center justify-center">
        <button
          type="button"
          onClick={onClose}
          aria-label="Close notifications"
          className="flex h-7 w-7 items-center justify-center rounded-full bg-[var(--tt-field)] text-[var(--tt-icon)] transition-colors hover:bg-[var(--tt-shape-neutral-3)]"
        >
          <CloseIcon className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* `.DivInboxContainer` — height 100%, flex column, padding 20px 8px 0, gap 16 */}
      <div className="flex h-full flex-col gap-4 px-2 pb-0 pt-5">
        {/* `.DivInboxHeaderContainer` — flex column, gap 16, flex 0 0 auto */}
        <div className="flex flex-none flex-col gap-4 px-2">
          {/* `.H2InboxTitle` — NowaDisplayFont 20px/25px/600 */}
          <div className="flex items-center justify-between gap-2">
            <h2 className="flex text-[20px] font-semibold leading-[25px] text-[var(--tt-text)]">
              Notifications
            </h2>
            {/* Not on the live drawer, which marks read per row only. Kept
                because the inbox here is unpaginated: with nothing to open,
                an old unread row would hold the badge up forever. */}
            {inbox.unreadCount > 0 && (
              <button
                type="button"
                onClick={inbox.markAllRead}
                className="me-9 shrink-0 cursor-pointer text-[13px] font-semibold leading-[17px] text-[var(--tt-text-tertiary,rgb(255_255_255_/_0.5))] transition-colors hover:text-[var(--tt-text)]"
              >
                Mark all read
              </button>
            )}
          </div>

          {/* `.DivGroupContainer` — flex wrap, gap 12px 8px */}
          <div className="flex flex-wrap gap-x-2 gap-y-3">
            {NOTIFICATION_FILTERS.map((chip) => (
              <FilterChip
                key={chip.label}
                label={chip.label}
                selected={filter === chip.label}
                onSelect={() => setFilter(chip.label)}
              />
            ))}
          </div>
        </div>

        {/* `.DivInboxContentContainer` — flex 1 1 auto, overflow auto, with an
            8px negative end margin so the scrollbar sits outside the padding. */}
        <div className="no-scrollbar -me-2 flex-1 overflow-auto pe-2">
          {groups.length === 0 && inbox.loaded && (
            <p className="px-2 py-6 text-[14px] leading-[18px] text-[rgb(255_255_255_/_0.5)]">
              No notifications yet.
            </p>
          )}
          {groups.map((group) => (
            <div key={group.title}>
              {/* `.PTimeGroupTitle` — 14px/600/18px, padding 0 8px 4px */}
              <p className="px-2 pb-1 text-[14px] font-semibold leading-[18px] text-[var(--tt-text)]">
                {group.title}
              </p>
              <ul>
                {group.items.map((item) => {
                  const actor = item.actorId ? inbox.actors.get(item.actorId) : undefined;
                  return (
                    <li key={item.id} className="mb-4 last:mb-0">
                      <NotificationItem
                        item={item}
                        actor={actor}
                        video={item.referenceId ? inbox.videos.get(item.referenceId) : undefined}
                        onOpen={() => openNotification(item)}
                        onOpenActor={() => openActor(item, actor)}
                      />
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/**
 * `.ButtonGroupItem` — padding 6px 12px, border-radius 999px, 14px/600/18px.
 *   selected   color #121212 on rgba(255,255,255,.9)
 *   unselected color rgba(255,255,255,.9) on rgba(255,255,255,.08)
 *   :hover     background rgba(255,255,255,.12)
 */
function FilterChip({
  label,
  selected,
  onSelect,
}: {
  label: string;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={cn(
        "cursor-pointer rounded-full px-3 py-1.5 text-center text-[14px] font-semibold leading-[18px] transition-colors",
        selected
          ? "bg-[rgb(255_255_255_/_0.9)] text-[#121212]"
          : "bg-[rgb(255_255_255_/_0.08)] text-[var(--tt-text)] hover:bg-[rgb(255_255_255_/_0.12)]",
      )}
    >
      {label}
    </button>
  );
}

/**
 * `.DivSystemNotifItemContainer` — flex row, align-items center, height 72px,
 * padding 0 8px, cursor pointer, `:hover { background: rgb(37,37,37) }`.
 *   `.DivSystemNotifIconContainer`     48×48, radius 24px, bg rgb(50,54,75)
 *   `.DivContentContainer`             padding 0 8px 0 0, flex 1 1 auto, min-width 0
 *   `.PTitleText`                      14px/600/18px, line-clamp 1
 *   `.PSystemNotifDescText`            13px/400/17px, line-clamp 1
 *   `.DivSystemNotifTrailingContainer` padding-left 12px, gap 10px, flex-shrink 0
 *   `TUXAlertBadgeDot`                 6px, #fe2c55, radius 999px
 */
/**
 * Verb line for an item with an actor. Only COMMENT carries extra content —
 * `body` is the comment's own text (see notification-service), truncated by
 * the same one-line `truncate` class every other line here already uses.
 */
function describe(item: NotificationResponse): string {
  switch (item.type) {
    case "LIKE":
      return "liked your video";
    case "SHARE":
      return "shared your video";
    case "NEW_FOLLOWER":
      return "started following you";
    case "COMMENT":
      return `commented: ${item.body}`;
    case "SYSTEM":
      return item.body;
  }
}

function NotificationItem({
  item,
  actor,
  video,
  onOpen,
  onOpenActor,
}: {
  item: NotificationResponse;
  /** Undefined while still resolving, or absent for SYSTEM (no actor). */
  actor: UserProfileResponse | undefined;
  /** Undefined while still resolving, absent for a non-video type, or one with no thumbnail. */
  video: VideoResponse | undefined;
  onOpen: () => void;
  onOpenActor: () => void;
}) {
  /**
   * The actor is the heading — a row about a person shows that person, never the service's own
   * "Bình luận mới" wording. `item.title` is only the heading for SYSTEM, which has no actor.
   * While the profile is still in flight the name is a skeleton rather than that fallback: the
   * batch lands in a moment and a placeholder that reads like real content is worse than a bar.
   */
  const pendingActor = Boolean(item.actorId) && !actor;
  const heading = actor ? (actor.username ?? "Someone") : item.title;

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onOpen();
        }
      }}
      className="flex h-[72px] cursor-pointer flex-row items-center px-2 transition-colors hover:bg-[rgb(37,37,37)]"
    >
      <div className="flex h-12 w-12 min-w-12 items-center justify-center rounded-3xl bg-[rgb(50,54,75)]">
        {item.actorId ? (
          // eslint-disable-next-line @next/next/no-img-element -- the avatar can be any CDN URL the account set; next/image would need each host allow-listed
          <img
            src={actor?.avatarUrl ?? DEFAULT_AVATAR}
            alt=""
            width={48}
            height={48}
            className="h-12 w-12 rounded-3xl object-cover"
          />
        ) : (
          <BellGlyph />
        )}
      </div>

      <div className="min-w-0 flex-1 pe-2 ps-3">
        <p className="truncate text-[14px] font-semibold leading-[18px] text-[var(--tt-text)]">
          {pendingActor ? (
            <span className="inline-block h-[14px] w-24 animate-pulse rounded bg-[rgb(255_255_255_/_0.12)] align-middle" />
          ) : actor ? (
            // Its own click target, narrower than the row: stopPropagation so
            // it doesn't also fire `onOpen` (the video/nothing the row goes to).
            <span
              role="link"
              tabIndex={0}
              onClick={(event) => {
                event.stopPropagation();
                onOpenActor();
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  event.stopPropagation();
                  onOpenActor();
                }
              }}
              className="hover:underline"
            >
              {heading}
            </span>
          ) : (
            heading
          )}
        </p>
        <p className="truncate text-[13px] leading-[17px] text-[var(--tt-text)]">
          {describe(item)} · {formatRelativeTime(item.createdAt)}
        </p>
      </div>

      {video?.thumbnailUrl && (
        <div className="h-12 w-12 flex-shrink-0 overflow-hidden rounded-sm">
          {/* eslint-disable-next-line @next/next/no-img-element -- CDN thumbnail, same reasoning as the avatar above */}
          <img
            src={video.thumbnailUrl}
            alt=""
            className="h-full w-full object-cover"
          />
        </div>
      )}

      <div className="flex flex-shrink-0 items-center justify-center gap-2.5 ps-3">
        {!item.read && (
          <span className="h-1.5 w-1.5 rounded-full bg-[var(--tt-red)]" />
        )}
      </div>
    </div>
  );
}

/** Reconstruction — the live icon comes from the unreadable TUX sprite. */
function BellGlyph() {
  return (
    <svg viewBox="0 0 48 48" className="h-6 w-6 text-white" fill="currentColor">
      <path d="M24 4a3 3 0 0 0-3 3v1.3A13 13 0 0 0 11 21v8.2l-2.7 4.3A2 2 0 0 0 10 36.5h28a2 2 0 0 0 1.7-3l-2.7-4.3V21a13 13 0 0 0-10-12.7V7a3 3 0 0 0-3-3Zm-5 36a5 5 0 0 0 10 0H19Z" />
    </svg>
  );
}

"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import {

  CodeXml,
  Link as LinkGlyph,
  Mail,
  MessageCircle,
  Repeat2,
  Search,
  Send,
} from "lucide-react";

import { useEscapeKey } from "@/hooks/use-escape-key";
import { CloseIcon } from "@/components/icons";
import { toast } from "@/components/ui/toast";
import { useSession } from "@/components/session/SessionProvider";
import { authorFromProfile } from "@/lib/api/adapters";
import { isApiError } from "@/lib/api/errors";
import { repostVideo } from "@/lib/api/interactions";
import { setRepostedByMe } from "@/lib/repost-context";
import { getFollowing, searchUsers } from "@/lib/api/users";
import { cn } from "@/lib/utils";
import { SHARE_FRIENDS, SHARE_TARGETS } from "@/lib/mock-feed";
import type { Author, ShareTarget } from "@/types/tiktok";

/** How many tiles the friends row shows, following or search results alike —
 * matches the mock row it replaces and the sheet's own scroller width. */
const FRIEND_LIMIT = 8;

/** Same debounce as the comment panel's @mention search — see CommentPanel. */
const SEARCH_DEBOUNCE_MS = 250;

/**
 * The share sheet is a **modal**, not a popover — clicking the rail's share
 * button mounts a full-viewport `.TUXModal` overlay. Measured live at 1920×936:
 *
 *   overlay   position: fixed, inset 0, z-index 3500,
 *             background: rgba(0,0,0,.7), flex column, centred, padding 16px
 *   dialog    480 × 333, background: rgb(30,30,30), border-radius: 12px
 *   navbar    .TUXModalNavBar, 52px tall, padding: 0 8px
 *             ├ 44×44 icon button (search)
 *             ├ h2 "Share to"  17px / 500 / 25.5px
 *             └ 44×44 icon button (close)
 *   body      flex column, gap 12px
 *             ├ friends row     128 tall, inner scroller 124, overflow-x auto
 *             ├ divider         1px, rgba(255,255,255,.19)
 *             └ targets row     128 tall, inner scroller 124, overflow-x auto
 *
 * 52 + (128 + 12 + 1 + 12 + 128) = 333, i.e. the dialog height is fully
 * accounted for by these numbers.
 *
 * Both rows reuse **one** tile shape — the friends row and the targets row
 * differ only in what fills the 64px slot:
 *
 *   tile                  88 × 124
 *   .DivActionContainer   padding: 12px 12px 8px
 *   .DivAction            flex column, gap 6px, width 64
 *   ├ icon / avatar       64 × 64  (avatar is border-radius 50%)
 *   └ label               12px / 400 / 15.6px, centred, #f6f6f6
 */
export function ShareSheet({
  videoId,
  shares,
  onClose,
}: {
  /** Mock video has no backend id to repost/share against — those tiles fall
   *  back to a local toast rather than a request that has nothing to hit. */
  videoId: string;
  /** Rendered into the title row's count on the live sheet's parent button. */
  shares: number;
  onClose: () => void;
}) {
  const { user, openLogin } = useSession();
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [friends, setFriends] = useState<Author[]>(SHARE_FRIENDS);
  const [results, setResults] = useState<Author[] | null>(null);

  useEscapeKey(onClose);

  /* Real accounts once signed in — the mock trio (see SHARE_FRIENDS) stands
     in for a guest, who has no following list to show. */
  useEffect(() => {
    if (!user) return;
    getFollowing(user.userId, 0, FRIEND_LIMIT)
      .then((page) => setFriends(page.content.map(authorFromProfile)))
      .catch(() => {
        // Left on the mock trio — a failed fetch should not empty the row.
      });
  }, [user]);

  /* The search icon's own row: user-service's search over every account,
     same debounce-and-abort shape as the comment panel's @mention lookup. */
  useEffect(() => {
    if (!searchOpen || !user) return;
    const trimmed = query.trim();
    // Clearing back to the friends row on an empty query is a direct response
    // to the keystroke that emptied it — handled in the input's own onChange,
    // not here, so this effect only ever fetches.
    if (!trimmed) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      searchUsers(trimmed, FRIEND_LIMIT, controller.signal)
        .then((page) => {
          if (controller.signal.aborted) return;
          setResults(page.content.filter((p) => p.userId !== user.userId).map(authorFromProfile));
        })
        .catch(() => {
          // Aborted or failed — the previous results stay rather than blinking out.
        });
    }, SEARCH_DEBOUNCE_MS);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [searchOpen, query, user]);

  const toggleSearch = () => {
    setSearchOpen((open) => !open);
    setQuery("");
    setResults(null);
  };

  const isMockVideo = !/^\d+$/.test(videoId);

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(
        new URL(`/video/${videoId}`, window.location.origin).href,
      );
      toast.success("Link copied.");
      onClose();
    } catch {
      toast.warning("Couldn’t copy the link.");
    }
  };

  const repost = async () => {
    if (!user) {
      openLogin();
      return;
    }
    if (isMockVideo) {
      toast.success("Reposted.");
      onClose();
      return;
    }
    try {
      await repostVideo(videoId);
      setRepostedByMe(videoId, user.userId, true);
      toast.success("Reposted.");
      onClose();
    } catch (cause) {
      if (isApiError(cause) && cause.is("REPOST_RATE_LIMITED")) {
        toast.warning("You’re reposting too fast — try again later.");
      } else {
        toast.warning("Couldn’t repost this video.");
      }
    }
  };

  const targetActions: Partial<Record<string, () => void>> = {
    copy: copyLink,
    repost,
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Share to — ${shares} shares`}
      onClick={onClose}
      className="fixed inset-0 z-[3500] flex flex-col items-center justify-center overflow-auto bg-black/70 p-4"
    >
      <div
        onClick={(event) => event.stopPropagation()}
        className="w-[480px] flex-none rounded-[12px] bg-[#1e1e1e]"
      >
        {/* `.TUXModalNavBar` — 44px slots either side of a centred title. */}
        <div className="flex h-[52px] items-center px-2">
          <button
            type="button"
            onClick={toggleSearch}
            aria-label={searchOpen ? "Close search" : "Search friends"}
            aria-pressed={searchOpen}
            className="flex h-11 w-11 flex-none items-center justify-center rounded-[4px] text-[var(--tt-text)] transition-colors hover:bg-[var(--tt-field)]"
          >
            <Search className="h-6 w-6" strokeWidth={2} />
          </button>
          {searchOpen ? (
            <input
              autoFocus
              type="text"
              value={query}
              onChange={(event) => {
                const value = event.target.value;
                setQuery(value);
                if (!value.trim()) setResults(null);
              }}
              placeholder="Search friends"
              className="h-9 flex-1 rounded-full bg-[var(--tt-field)] px-4 text-[15px] text-[var(--tt-text)] outline-none placeholder:text-[var(--tt-text-secondary)]"
            />
          ) : (
            <h2 className="flex-1 text-center text-[17px] font-medium leading-[25.5px] text-[var(--tt-text)]">
              Share to
            </h2>
          )}
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex h-11 w-11 flex-none items-center justify-center rounded-[4px] text-[var(--tt-text)] transition-colors hover:bg-[var(--tt-field)]"
          >
            <CloseIcon className="h-6 w-6" />
          </button>
        </div>

        <div className="flex flex-col gap-3">
          <ScrollRow>
            {(results ?? friends).map((friend) => (
              <FriendTile key={friend.username} friend={friend} />
            ))}
          </ScrollRow>

          <div className="h-px bg-[rgba(255,255,255,0.19)]" />

          <ScrollRow>
            {SHARE_TARGETS.map((target) => (
              <TargetTile key={target.id} target={target} onClick={targetActions[target.id]} />
            ))}
          </ScrollRow>
        </div>
      </div>
    </div>
  );
}

/** 128px row wrapping a 124px horizontal scroller — the 4px is the hidden bar. */
function ScrollRow({ children }: { children: React.ReactNode }) {
  return (
    <div className="h-32">
      <div className="no-scrollbar flex h-[124px] overflow-x-auto px-3">
        {children}
      </div>
    </div>
  );
}

function Tile({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick?: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-[88px] flex-none flex-col items-center px-3 pb-2 pt-3"
    >
      <span className="flex w-16 flex-col items-center gap-1.5">
        {children}
        <span className="w-16 truncate text-center text-[12px] font-normal leading-[15.6px] text-[var(--tt-text)]">
          {label}
        </span>
      </span>
    </button>
  );
}

function FriendTile({ friend }: { friend: Author }) {
  return (
    <Tile label={friend.nickname}>
      <Image
        src={friend.avatarUrl}
        alt=""
        width={64}
        height={64}
        className="h-16 w-16 rounded-full object-cover"
      />
    </Tile>
  );
}

/**
 * The live tile draws each service's own logo inside a 64px disc. Those are
 * third-party trademarks — and not TikTok's assets to begin with — so the clone
 * does **not** reproduce them. Instead every disc keeps the measured 64px size,
 * spacing and label, and gets:
 *   - the neutral field colour plus a Lucide glyph, for the actions TikTok owns
 *     (Repost, Copy, Embed, Email);
 *   - the service's brand colour plus either a *generic* Lucide glyph where one
 *     reads unambiguously (a speech bubble for WhatsApp, a paper plane for
 *     Telegram) or the service's initial where it does not.
 * The layout is therefore faithful even though the marks deliberately are not.
 *
 * Lucide v1 dropped its brand icons (no `Facebook`, `Twitter`, `Linkedin`), so
 * substituting logos from the icon set was not an option regardless.
 *
 * `onClick` is only set for the tiles TikTok owns end to end here (Copy,
 * Repost) — the third-party targets have no share-intent wiring yet and stay
 * inert, same as before.
 */
function TargetTile({ target, onClick }: { target: ShareTarget; onClick?: () => void }) {
  const Glyph = NATIVE_GLYPHS[target.id];

  return (
    <Tile label={target.label} onClick={onClick}>
      <span
        className={cn(
          "flex h-16 w-16 flex-none items-center justify-center rounded-full",
          !target.tint && "bg-[var(--tt-field)]",
        )}
        style={target.tint ? { backgroundColor: target.tint } : undefined}
      >
        {Glyph ? (
          <Glyph className="h-7 w-7 text-[var(--tt-text)]" strokeWidth={2} />
        ) : (
          <span className="text-[24px] font-bold leading-none text-white">
            {target.label.charAt(0)}
          </span>
        )}
      </span>
    </Tile>
  );
}

/** Tiles that get a glyph; every other tile falls back to its initial. */
const NATIVE_GLYPHS: Record<
  string,
  React.ComponentType<{ className?: string; strokeWidth?: number }> | undefined
> = {
  repost: Repeat2,
  copy: LinkGlyph,
  embed: CodeXml,
  email: Mail,
  whatsapp: MessageCircle,
  telegram: Send,
};

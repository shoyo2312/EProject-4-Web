"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {

  CodeXml,
  Link as LinkGlyph,
  Mail,
  MessageCircle,
  Repeat2,
  Search,
  Send,
} from "lucide-react";

import { RecipientTile } from "@/components/feed/share/RecipientTile";
import { ReopenQuestion, ShareCompose } from "@/components/feed/share/ShareCompose";
import { useChatUnreadContext } from "@/components/messages/ChatUnreadProvider";
import { useEscapeKey } from "@/hooks/use-escape-key";
import { useFocusTrap } from "@/hooks/use-focus-trap";
import { useShareSend } from "@/hooks/use-share-send";
import { CloseIcon } from "@/components/icons";
import { toast } from "@/components/ui/toast";
import { useSession } from "@/components/session/SessionProvider";
import { authorFromProfile } from "@/lib/api/adapters";
import { isApiError } from "@/lib/api/errors";
import { repostVideo, shareVideo } from "@/lib/api/interactions";
import { setRepostedByMe } from "@/lib/repost-context";
import { shareIntentUrl } from "@/lib/share";
import { searchUsers } from "@/lib/api/users";
import { recentRecipients, unavailableReason, type ShareRecipient } from "@/lib/share-recipients";
import { SHARE_TARGETS } from "@/lib/site-config";
import { cn } from "@/lib/utils";
import type { ShareTarget } from "@/types/tiktok";

/** How many accounts a search brings into the recipients row. */
const SEARCH_LIMIT = 12;

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
  onShared,
}: {
  videoId: string;
  /** Rendered into the title row's count on the live sheet's parent button. */
  shares: number;
  onClose: () => void;
  /** This many shares were really made: chats delivered, or a link copied or handed to another service. */
  onShared?: (count: number) => void;
}) {
  const { user, openLogin } = useSession();
  const viewerId = user?.userId;
  const chat = useChatUnreadContext();
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ShareRecipient[] | null>(null);
  const [searchFailed, setSearchFailed] = useState(false);

  const delivered = useCallback((count: number) => onShared?.(count), [onShared]);
  const share = useShareSend(videoId, delivered, onClose);
  const closeUnlessSending = useCallback(() => {
    if (!share.sending) onClose();
  }, [share.sending, onClose]);

  useEscapeKey(closeUnlessSending);
  const dialogRef = useRef<HTMLDivElement>(null);
  useFocusTrap(dialogRef);

  /* Whom the viewer talked to last, from the conversations already live in the chat provider: the
     newest message first, whatever is pinned. A guest has no chats, and gets no row. */
  const recents = useMemo(
    () => (viewerId ? recentRecipients(chat.conversations, chat.authors, viewerId) : []),
    [chat.conversations, chat.authors, viewerId],
  );
  const names = useMemo(() => {
    const all = new Map<string, string>();
    for (const r of [...recents, ...(results ?? []), ...share.picked.values()]) all.set(r.userId, r.author.nickname);
    return all;
  }, [recents, results, share.picked]);

  /* The search icon's own row: user-service's search over every account,
     same debounce-and-abort shape as the comment panel's @mention lookup. */
  useEffect(() => {
    if (!searchOpen || !viewerId) return;
    const trimmed = query.trim();
    // Clearing back to the friends row on an empty query is a direct response
    // to the keystroke that emptied it — handled in the input's own onChange,
    // not here, so this effect only ever fetches.
    if (!trimmed) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      searchUsers(trimmed, SEARCH_LIMIT, controller.signal)
        .then((page) => {
          if (controller.signal.aborted) return;
          setSearchFailed(false);
          setResults(
            page.content
              .filter((p) => p.userId !== viewerId)
              .map((p) => ({ userId: p.userId, author: authorFromProfile(p) })),
          );
        })
        .catch(() => {
          // Aborted: the next query owns the row. Failed: the previous results stay, with a note.
          if (!controller.signal.aborted) setSearchFailed(true);
        });
    }, SEARCH_DEBOUNCE_MS);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [searchOpen, query, viewerId]);

  const toggleSearch = () => {
    setSearchOpen((open) => !open);
    setQuery("");
    setResults(null);
    setSearchFailed(false);
  };

  const videoLink = () => new URL(`/video/${videoId}`, window.location.origin).href;

  /* Copying the link and handing it to another service are the shares this sheet counts itself;
     a send into a chat is counted by chat-service, once per delivered message. */
  const countShare = () => {
    if (!user) return;
    shareVideo(videoId).then(
      () => onShared?.(1),
      () => {},
    );
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(videoLink());
      toast.success("Link copied.");
      countShare();
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

  /** Hands the link to the service's own share page — a new tab, or the mail app. */
  const shareTo = (targetId: string) => {
    const href = shareIntentUrl(targetId, videoLink());
    if (!href) return;
    countShare();
    if (href.startsWith("mailto:")) window.location.assign(href);
    else window.open(href, "_blank", "noopener,noreferrer");
    onClose();
  };

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-label={`Share to — ${shares} shares`}
      onClick={closeUnlessSending}
      className="fixed inset-0 z-[3500] flex flex-col items-center justify-center overflow-auto bg-black/70 p-4"
    >
      <div
        onClick={(event) => event.stopPropagation()}
        className="relative w-[480px] max-w-full flex-none rounded-[12px] bg-[#1e1e1e]"
      >
        {share.reopenAsk && <ReopenQuestion ask={share.reopenAsk} />}
        {/* `.TUXModalNavBar` — 44px slots either side of a centred title. */}
        <div className="flex h-[52px] items-center px-2">
          <button
            type="button"
            onClick={toggleSearch}
            aria-label={searchOpen ? "Close search" : "Search people"}
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
              placeholder="Search people"
              className="h-9 flex-1 rounded-full bg-[var(--tt-field)] px-4 text-[15px] text-[var(--tt-text)] outline-none placeholder:text-[var(--tt-text-secondary)]"
            />
          ) : (
            <h2 className="flex-1 text-center text-[17px] font-medium leading-[25.5px] text-[var(--tt-text)]">
              {share.picked.size > 0 ? "Send to" : "Share to"}
            </h2>
          )}
          <button
            type="button"
            onClick={closeUnlessSending}
            disabled={share.sending}
            aria-label="Close"
            className="flex h-11 w-11 flex-none items-center justify-center rounded-[4px] text-[var(--tt-text)] transition-colors hover:bg-[var(--tt-field)]"
          >
            <CloseIcon className="h-6 w-6" />
          </button>
        </div>

        <div className="flex flex-col gap-3">
          {viewerId && (
            <>
              <ScrollRow>
                {(searchOpen && results ? results : recents).map((recipient) => (
                  <RecipientTile
                    key={recipient.userId}
                    recipient={recipient}
                    selected={share.picked.has(recipient.userId)}
                    sent={share.sent.has(recipient.userId)}
                    disabledReason={unavailableReason(recipient.userId, chat.conversations, viewerId)}
                    failure={share.failures[recipient.userId]}
                    busy={share.sending}
                    onToggle={() => share.toggle(recipient)}
                  />
                ))}
                <RecipientsStatus
                  searching={searchOpen && query.trim() !== ""}
                  searchFailed={searchFailed}
                  hasRows={(searchOpen && results ? results : recents).length > 0}
                  results={results}
                  chatStatus={chat.status}
                  onRetry={chat.reload}
                />
              </ScrollRow>

              <div className="h-px bg-[rgba(255,255,255,0.19)]" />
            </>
          )}

          {share.picked.size > 0 ? (
            <ShareCompose
              count={share.picked.size}
              note={share.note}
              onNote={share.setNote}
              sending={share.sending}
              failures={share.failures}
              names={names}
              onSend={() => void share.send()}
            />
          ) : (
            <ScrollRow>
              {SHARE_TARGETS.map((target) => (
                <TargetTile
                  key={target.id}
                  target={target}
                  onClick={targetActions[target.id] ?? (() => shareTo(target.id))}
                />
              ))}
            </ScrollRow>
          )}
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

/** What stands in the recipients row when there are no tiles to show, or beside them when something went wrong. */
function RecipientsStatus({
  searching,
  searchFailed,
  hasRows,
  results,
  chatStatus,
  onRetry,
}: {
  searching: boolean;
  searchFailed: boolean;
  hasRows: boolean;
  results: ShareRecipient[] | null;
  chatStatus: "loading" | "ready" | "error";
  onRetry: () => void;
}) {
  const text =
    "flex h-full min-w-[200px] flex-1 items-center justify-center px-4 text-center text-[13px] text-[var(--tt-text-muted)]";
  if (searching && searchFailed) {
    return (
      <p role="alert" className={text}>
        Couldn&apos;t search. Try again.
      </p>
    );
  }
  if (searching && results === null) return <p className={text}>Searching…</p>;
  if (searching && results?.length === 0) return <p className={text}>No one found.</p>;
  if (searching || hasRows) return null;
  if (chatStatus === "loading") {
    return (
      <div aria-hidden className="flex">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="flex w-[88px] flex-none flex-col items-center px-3 pt-3">
            <div className="h-16 w-16 animate-pulse rounded-full bg-[var(--tt-field)]" />
            <div className="mt-2 h-3 w-12 animate-pulse rounded bg-[var(--tt-field)]" />
          </div>
        ))}
      </div>
    );
  }
  if (chatStatus === "error") {
    return (
      <div role="alert" className={text}>
        Couldn&apos;t load your chats.
        <button type="button" onClick={onRetry} className="ml-2 font-semibold text-[var(--tt-text)] underline">
          Retry
        </button>
      </div>
    );
  }
  return <p className={text}>No recent chats. Search for someone to send this to.</p>;
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
 * Copy and Repost act here; the third-party tiles open the service's own share
 * page (`lib/share.ts`). Embed has no embeddable player route to point at yet,
 * so it stays inert.
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

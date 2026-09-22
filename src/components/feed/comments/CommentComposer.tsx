"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";

import { COMMENT_MAX_LENGTH, type ReplyTarget } from "@/components/feed/comments/types";
import {
  ArrowPostIcon,
  AtIcon,
  CloseIcon,
  CommentIcon,
  EmojiIcon,
} from "@/components/icons";
import { useSession } from "@/components/session/SessionProvider";
import { useDismiss } from "@/hooks/use-dismiss";
import { DEFAULT_AVATAR } from "@/lib/api/adapters";
import type { UserProfileResponse } from "@/lib/api/types";
import { getFollowing, searchUsers } from "@/lib/api/users";
import { COMPOSER_EMOJI_GROUPS } from "@/lib/comments/emoji-groups";
import {
  MENTION_DEBOUNCE_MS,
  MENTION_LIMIT,
  type MentionToken,
  mentionHandle,
  mentionTokenAt,
} from "@/lib/comments/mention";
import { cn } from "@/lib/utils";

/**
 * `.DivCommentFooter` > `.DivCommentBarContainer` — 42px tall.
 *   avatar               32×32, border-radius 50%
 *   `.DivTextInputContainer`  height 42, background rgba(255,255,255,.13),
 *                             border-radius 22px, padding 0 8px
 *   two ghost TUXButtons      32×32, border-radius 8px, padding 4px
 *   `.ArrowPostButton`        32×32, background #fe2c55, border-radius 999px
 *
 * Reply mode — placeholder swap plus a cancel affordance — is a
 * **reconstruction, not an extraction**. The live "Reply" control did not
 * respond to a synthetic click or to a positioned real click in two attempts,
 * and I stopped there rather than keep clicking around a comment box on a
 * signed-in account, where an accidental hit could post something. So the
 * placeholder wording and the ✕ are invented; only the bar's geometry above is
 * measured.
 */
export function CommentComposer({
  ref,
  replyTo,
  onCancelReply,
  onPost,
}: {
  ref: React.RefObject<HTMLInputElement | null>;
  replyTo: ReplyTarget | null;
  onCancelReply: () => void;
  onPost: (text: string) => void;
}) {
  const [value, setValue] = useState("");
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [mention, setMention] = useState<MentionToken | null>(null);
  const [mentionResults, setMentionResults] = useState<UserProfileResponse[]>([]);
  const [mentionIndex, setMentionIndex] = useState(0);
  const [limitHit, setLimitHit] = useState(false);
  const barRef = useRef<HTMLDivElement>(null);
  const canPost = value.trim() !== "";
  const { user, openLogin } = useSession();
  const mentionQuery = mention?.query ?? null;
  const mentionOpen = mention !== null && mentionResults.length > 0;

  /* The "max reached" hint is transient — clear it a couple seconds after the
     last blocked keystroke. */
  useEffect(() => {
    if (!limitHit) return;
    const id = window.setTimeout(() => setLimitHit(false), 3500);
    return () => window.clearTimeout(id);
  }, [limitHit]);

  /* Any click outside the bar dismisses whichever tray is open. */
  const closeTrays = useCallback(() => {
    setEmojiOpen(false);
    setMention(null);
  }, []);
  useDismiss(barRef, emojiOpen || mention !== null, closeTrays);

  /*
   * Who can be tagged: with nothing typed after the "@", the accounts the
   * viewer follows; from the first character on, user-service's search over
   * every account. Both need a token, so a signed-out viewer never gets here.
   */
  useEffect(() => {
    if (mentionQuery === null || !user) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      const request = mentionQuery
        ? searchUsers(mentionQuery, MENTION_LIMIT, controller.signal)
        : getFollowing(user.userId, 0, MENTION_LIMIT);
      request
        .then((page) => {
          if (controller.signal.aborted) return;
          setMentionResults(page.content.filter((p) => p.userId !== user.userId));
          setMentionIndex(0);
        })
        .catch(() => {
          // Aborted or failed — the previous list stays rather than blinking out.
        });
    }, MENTION_DEBOUNCE_MS);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [mentionQuery, user]);

  /* Re-read the token on every keystroke and every caret move. */
  const syncMention = (nextValue: string, caret: number | null) => {
    const token = mentionTokenAt(nextValue, caret ?? nextValue.length);
    // Dropping the token drops its results too, so reopening never flashes the
    // answers to a query the viewer has already typed past.
    if (!token) setMentionResults([]);
    setMention(token);
  };

  /** Swap the half-typed "@tok" for the picked handle and carry on typing. */
  const applyMention = (profile: UserProfileResponse) => {
    if (!mention) return;
    const input = ref.current;
    const caret = input?.selectionStart ?? value.length;
    const handle = `@${mentionHandle(profile)} `;
    setValue(value.slice(0, mention.start) + handle + value.slice(caret));
    const next = mention.start + handle.length;
    setMention(null);
    setMentionResults([]);
    requestAnimationFrame(() => {
      input?.focus();
      input?.setSelectionRange(next, next);
    });
  };

  /* Insert at the caret (replacing any selection) and keep typing where it lands. */
  const insertAtCaret = (text: string) => {
    const input = ref.current;
    const start = input?.selectionStart ?? value.length;
    const end = input?.selectionEnd ?? value.length;
    setValue(value.slice(0, start) + text + value.slice(end));
    const caret = start + text.length;
    requestAnimationFrame(() => {
      input?.focus();
      input?.setSelectionRange(caret, caret);
    });
  };

  const submit = () => {
    if (!canPost) return;
    onPost(value.trim());
    setValue("");
  };

  /*
   * Signed out, the live panel still loads and lets a guest read every comment
   * — only the composer is replaced. `.DivCommentFooter` keeps its 64px, and
   * `.StyledLoginButton` fills the column: 352 × 40 at the measured width,
   * `#FE2C55`, `border-radius: 999px`, a 20px glyph and a 16px/600 label with
   * 4px between them, the bar sitting 16px below the list.
   */
  if (!user) {
    return (
      <div className="flex h-16 flex-none items-end">
        <button
          type="button"
          onClick={openLogin}
          className="flex h-10 w-full items-center justify-center gap-1 rounded-full bg-[var(--tt-red)] px-3 text-[var(--tt-text)] transition-colors hover:bg-[var(--tt-red-hover)]"
        >
          <CommentIcon className="h-5 w-5 flex-none" />
          <span className="text-[16px] font-semibold text-white">
            Log in to comment
          </span>
        </button>
      </div>
    );
  }

  return (
    <div className="relative flex flex-none flex-col pt-3">
      {/* Max-length hint — floats above the bar (opaque background, z-30) so its
          show/hide neither reflows the comment list nor shows through it.
          Kept mounted and toggled by class so it animates in AND out. */}
      <p
        role="status"
        aria-hidden={!limitHit}
        className={cn(
          "pointer-events-none absolute inset-x-0 bottom-full z-30 mb-1.5 rounded-[8px] border border-[var(--tt-divider)] bg-[var(--tt-sheet-3)] px-3 py-1.5 text-[12px] leading-[16px] text-[#f6708a] shadow-lg transition-all duration-150 ease-out",
          limitHit ? "translate-y-0 opacity-100" : "translate-y-1 opacity-0",
        )}
      >
        Bình luận tối đa {COMMENT_MAX_LENGTH} ký tự.
      </p>


      {/* Reply banner — names the thread the composer is aimed at. */}
      {replyTo && (
        <div className="mb-2 flex animate-[tt-comment-in_200ms_ease-out] items-center justify-between rounded-[8px] bg-[var(--tt-field)] px-3 py-1.5">
          <span className="truncate text-[13px] leading-[19.5px] text-[var(--tt-text-secondary)]">
            Replying to{" "}
            <span className="font-semibold text-[var(--tt-text)]">
              @{replyTo.username}
            </span>
          </span>
          <button
            type="button"
            onClick={() => {
              onCancelReply();
              setValue("");
            }}
            aria-label="Cancel reply"
            className="ml-2 flex h-5 w-5 flex-none items-center justify-center rounded-full text-[var(--tt-icon)] transition-colors hover:bg-[var(--tt-shape-neutral-3)]"
          >
            <CloseIcon className="h-3 w-3" />
          </button>
        </div>
      )}

      <div ref={barRef} className="relative flex items-center gap-2">
      <Image
        src={user.avatarUrl || DEFAULT_AVATAR}
        alt={user.nickname}
        width={32}
        height={32}
        // Hidden from the tablet width down, as the live site does: at 18rem
        // the sidebar has no room for it and the input is what the viewer came
        // for. The avatar is decorative here — the viewer knows who they are.
        className="h-8 w-8 flex-none rounded-full object-cover tt-1024:hidden"
      />

      {/*
        `min-w-0`: the input's own min-width:0 lets the input shrink, but this
        field is itself a flex item whose automatic minimum is its content's —
        which still counts the input's default 20-character width. Without it
        the bar is 342px wide inside a 256px panel at tablet widths, and the
        emoji/@/send controls sit outside the sidebar, clipped and unclickable.
      */}
      <div className="flex h-[42px] min-w-0 flex-1 items-center gap-1 rounded-[22px] bg-[var(--tt-field)] px-2">
        <input
          ref={ref}
          value={value}
          maxLength={COMMENT_MAX_LENGTH}
          onChange={(event) => {
            setValue(event.target.value);
            syncMention(event.target.value, event.target.selectionStart);
            if (event.target.value.length < COMMENT_MAX_LENGTH) setLimitHit(false);
          }}
          onSelect={(event) =>
            syncMention(event.currentTarget.value, event.currentTarget.selectionStart)
          }
          onKeyDown={(event) => {
            /* At the cap, a printable keystroke with no selection to replace is
               silently dropped by `maxLength` — surface it as a small hint. */
            const el = event.currentTarget;
            if (
              el.value.length >= COMMENT_MAX_LENGTH &&
              el.selectionStart === el.selectionEnd &&
              event.key.length === 1 &&
              !event.ctrlKey &&
              !event.metaKey &&
              !event.altKey
            ) {
              setLimitHit(true);
            }

            /* While the mention list is up it owns the arrows and Enter. */
            if (mentionOpen) {
              if (event.key === "ArrowDown" || event.key === "ArrowUp") {
                event.preventDefault();
                const step = event.key === "ArrowDown" ? 1 : mentionResults.length - 1;
                setMentionIndex((i) => (i + step) % mentionResults.length);
                return;
              }
              if (event.key === "Enter") {
                event.preventDefault();
                applyMention(mentionResults[mentionIndex]);
                return;
              }
              if (event.key === "Escape") {
                setMention(null);
                return;
              }
            }
            if (event.key === "Enter") submit();
            if (event.key === "Escape") {
              if (emojiOpen) setEmojiOpen(false);
              else if (replyTo) onCancelReply();
            }
          }}
          placeholder={
            replyTo ? `Reply to @${replyTo.username}...` : "Add comment..."
          }
          aria-label={
            replyTo ? `Reply to ${replyTo.username}` : "Add comment"
          }
          className="min-w-0 flex-1 bg-transparent px-1 text-[14px] text-[var(--tt-text)] outline-none placeholder:text-[var(--tt-placeholder)]"
        />
        <div className="relative flex-none">
          <button
            type="button"
            aria-label="Emoji"
            aria-expanded={emojiOpen}
            onClick={() => setEmojiOpen((open) => !open)}
            className={cn(
              "flex h-8 w-8 items-center justify-center rounded-[8px] p-1 text-[var(--tt-icon)] transition-colors hover:bg-[var(--tt-shape-neutral-3)]",
              emojiOpen && "bg-[var(--tt-shape-neutral-3)]",
            )}
          >
            <EmojiIcon className="h-5 w-5" />
          </button>

          {emojiOpen && (
            <div className="no-scrollbar absolute bottom-10 right-0 z-20 max-h-[248px] w-[288px] animate-[tt-comment-in_150ms_ease-out] overflow-y-auto rounded-[8px] border border-[var(--tt-divider)] bg-[var(--tt-sheet-3)] p-2 shadow-lg">
              {COMPOSER_EMOJI_GROUPS.map((group) => (
                <div key={group.label} className="mb-1 last:mb-0">
                  <p className="px-1 pb-1 text-[11px] font-semibold uppercase tracking-wide text-[var(--tt-text-muted)]">
                    {group.label}
                  </p>
                  <div className="grid grid-cols-8 gap-1">
                    {group.emojis.map((emoji) => (
                      <button
                        key={emoji}
                        type="button"
                        onClick={() => insertAtCaret(emoji)}
                        aria-label={emoji}
                        className="flex h-8 w-8 items-center justify-center rounded-[6px] text-[18px] leading-none transition-colors hover:bg-[var(--tt-shape-neutral-3)]"
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        <button
          type="button"
          aria-label="Mention"
          onClick={() => {
            setEmojiOpen(false);
            // Typing the "@" is what opens the list — `onSelect` fires when the
            // caret lands after it, and the token lookup takes it from there.
            insertAtCaret("@");
          }}
          className="flex h-8 w-8 flex-none items-center justify-center rounded-[8px] p-1 text-[var(--tt-icon)] transition-colors hover:bg-[var(--tt-shape-neutral-3)]"
        >
          <AtIcon className="h-5 w-5" />
        </button>
      </div>

      {mentionOpen && (
        <ul className="no-scrollbar absolute bottom-12 left-10 right-10 z-20 max-h-[240px] animate-[tt-comment-in_150ms_ease-out] overflow-y-auto rounded-[8px] border border-[var(--tt-divider)] bg-[var(--tt-sheet-3)] py-1 shadow-lg">
          {mentionResults.map((profile, index) => (
            <li key={profile.userId}>
              <button
                type="button"
                onMouseEnter={() => setMentionIndex(index)}
                // The input keeps focus, so the caret is still there to write into.
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => applyMention(profile)}
                className={cn(
                  "flex w-full items-center gap-2 px-3 py-1.5 text-left transition-colors",
                  index === mentionIndex && "bg-[var(--tt-shape-neutral-3)]",
                )}
              >
                <Image
                  src={profile.avatarUrl ?? DEFAULT_AVATAR}
                  alt=""
                  width={32}
                  height={32}
                  className="h-8 w-8 flex-none rounded-full object-cover"
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[14px] font-semibold text-[var(--tt-text)]">
                    {profile.displayName ?? `user${profile.userId}`}
                  </span>
                  <span className="block truncate text-[12px] text-[var(--tt-text-secondary)]">
                    @{mentionHandle(profile)}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      <button
        type="button"
        onClick={submit}
        disabled={!canPost}
        aria-label={replyTo ? "Post reply" : "Post comment"}
        className={cn(
          "flex h-8 w-8 flex-none items-center justify-center rounded-full bg-[var(--tt-red)] p-2 text-white",
          "transition-[opacity,background-color] disabled:opacity-40",
          canPost && "hover:bg-[var(--tt-red-hover)]",
        )}
      >
        <ArrowPostIcon className="h-4 w-4" />
      </button>
      </div>
    </div>
  );
}

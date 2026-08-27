"use client";

import Link from "next/link";
import { useState } from "react";

import {
  AddFriendIcon,
  BioLinkIcon,
  MoreHorizontalIcon,
  SettingsIcon,
  ShareIcon,
  VerifiedBadgeIcon,
} from "@/components/icons";
import { displayHandle } from "@/lib/api/adapters";
import { formatCount } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { UserProfile } from "@/types/tiktok";

/**
 * `.CreatorPageHeader` — the 172px avatar beside the identity column.
 *
 * Measured live at 1920px (see `docs/research/tiktok.com/PROFILE.md`):
 *   header     flex, align-items: flex-start, gap 28px, margin-bottom 20px
 *   avatar     172×172 circle
 *   title      24/30/700, then a divider and the handle at 16/21/400 @ .6
 *   stats      number 16/700 and label 16/400 differ only in weight, 6px apart,
 *              groups 20px apart — not the wider gap it looks like
 *   buttons    44px tall pills, gap 12px, label 16/600
 *
 * Which buttons appear is the page's only real fork: the owner gets
 * Edit profile / Promote post / settings / share, a visitor gets
 * Follow / Message / add-friend / share / more.
 */
export function ProfileHeader({
  profile,
  isOwner,
  requireSignIn,
  onEditProfile,
  onToggleFollow,
  onOpenFollowers,
  onOpenFollowing,
}: {
  profile: UserProfile;
  isOwner: boolean;
  /**
   * The session's gate. Returns true when the viewer may act; otherwise it
   * opens the login modal, which is what the live site does for every one of
   * these controls.
   */
  requireSignIn: () => boolean;
  /** Opens the Edit profile modal. Only the owner's header can reach it. */
  onEditProfile: () => void;
  /**
   * Persists the follow state. Absent for mock profiles, where the toggle is
   * only local. Rejecting puts the button back where it was.
   */
  onToggleFollow?: (next: boolean) => Promise<void>;
  /**
   * Opens the Followers/Following dialog on that stat. Absent for mock
   * profiles — there is no backend account to list connections for.
   */
  onOpenFollowers?: () => void;
  onOpenFollowing?: () => void;
}) {
  const [following, setFollowing] = useState(profile.isFollowing);
  const [followPending, setFollowPending] = useState(false);

  /**
   * The button owns its state so a click responds instantly, but the server's
   * answer can arrive *after* the first render — the relationship is a second
   * request, and it cannot even be asked until the session is known. Without
   * this, a page you already follow renders "Follow" forever, because
   * `useState` ignores every later prop. Comparing against the previous prop
   * (rather than assigning on each render) keeps a click from being undone by
   * the next re-render.
   */
  const [lastFromServer, setLastFromServer] = useState(profile.isFollowing);
  if (profile.isFollowing !== lastFromServer) {
    setLastFromServer(profile.isFollowing);
    setFollowing(profile.isFollowing);
  }

  /**
   * Optimistic, then reconciled. The button also locks while the request is in
   * flight: two follow/unfollow calls racing produce `CONCURRENT_MODIFICATION`
   * on the server and a flickering follower count on screen.
   */
  const toggleFollow = async () => {
    if (!requireSignIn() || followPending) return;

    const next = !following;
    setFollowing(next);

    if (!onToggleFollow) return;

    setFollowPending(true);
    try {
      await onToggleFollow(next);
    } catch {
      setFollowing(!next);
    } finally {
      setFollowPending(false);
    }
  };

  return (
    <header className="mt-3 mb-5 flex items-start gap-7 tt-840:gap-4">
      {/* eslint-disable-next-line @next/next/no-img-element -- local static asset, no optimisation needed */}
      <img
        src={profile.author.avatarUrl}
        alt=""
        className="h-[172px] w-[172px] flex-none rounded-full object-cover tt-840:h-24 tt-840:w-24"
      />

      <div className="flex min-w-0 flex-col">
        <div className="flex items-center">
          <h1 className="truncate text-[24px] leading-[30px] font-bold text-[var(--tt-text)]">
            {profile.author.nickname}
          </h1>
          {displayHandle(profile.author) && (
            <>
              <span className="mx-3 text-[16px] leading-[21px] text-[rgb(255_255_255/0.6)]">
                |
              </span>
              <h2 className="flex max-w-[450px] items-center gap-1 truncate text-[16px] leading-[21px] text-[rgb(255_255_255/0.6)]">
                {displayHandle(profile.author)}
                {profile.isVerified && (
                  <VerifiedBadgeIcon className="h-4 w-4 flex-none" />
                )}
              </h2>
            </>
          )}
        </div>

        {/* `h3.H3Count` — the three stat groups. */}
        <h3 className="mt-1.5 flex flex-wrap text-[16px] leading-[21px] text-[var(--tt-icon)]">
          <Stat
            value={profile.stats.following}
            label="Following"
            onClick={onOpenFollowing}
          />
          <Stat
            value={profile.stats.followers}
            label="Followers"
            onClick={onOpenFollowers}
          />
          <Stat value={profile.stats.likes} label="Likes" last />
        </h3>

        <div className="mt-2 flex items-center gap-3">
          {isOwner ? (
            <>
              <PillButton onClick={onEditProfile}>Edit profile</PillButton>
              {/*<PillButton onClick={requireSignIn}>Promote post</PillButton>*/}
              {/* The one owner control that is a real destination. */}
              <Link
                href="/setting"
                aria-label="Settings"
                title="Settings"
                className="flex h-11 w-11 flex-none items-center justify-center rounded-full bg-[var(--tt-field)] text-[var(--tt-icon)] transition-colors hover:bg-[var(--tt-shape-neutral-3)]"
              >
                <SettingsIcon className="h-5 w-5" />
              </Link>
            </>
          ) : (
            <>
              <PillButton primary={!following} onClick={toggleFollow}>
                {following ? "Following" : "Follow"}
              </PillButton>
              <PillButton onClick={requireSignIn}>Message</PillButton>
              <IconButton label="Suggest friends" onClick={requireSignIn}>
                <AddFriendIcon className="h-5 w-5" />
              </IconButton>
            </>
          )}

          <IconButton label="Share profile" onClick={requireSignIn}>
            <ShareIcon className="h-5 w-5" />
          </IconButton>

          {!isOwner && (
            <IconButton label="More" onClick={requireSignIn}>
              <MoreHorizontalIcon className="h-5 w-5" />
            </IconButton>
          )}
        </div>

        <p className="mt-3.5 max-w-[600px] text-[16px] leading-[21px] whitespace-pre-line text-[var(--tt-text)]">
          {profile.bio || "No bio yet."}
        </p>

        {profile.link && (
          <a
            href={`https://${profile.link}`}
            target="_blank"
            rel="noreferrer noopener"
            className="mt-1.5 flex max-w-[256px] items-center gap-1.5 truncate text-[16px] leading-[18px] font-semibold text-[var(--tt-red-active)]"
          >
            <BioLinkIcon className="h-4 w-4 flex-none" />
            <span className="truncate">{profile.link}</span>
          </a>
        )}
      </div>
    </header>
  );
}

/** `.DivNumber` — value and label 6px apart, groups 20px apart. */
function Stat({
  value,
  label,
  last,
  onClick,
}: {
  value: number;
  label: string;
  last?: boolean;
  /** Opens the Followers/Following dialog. Absent for the plain Likes stat. */
  onClick?: () => void;
}) {
  if (!onClick) {
    return (
      <div className={cn("flex", !last && "mr-5")}>
        <strong className="font-bold">{formatCount(value)}</strong>
        <span className="ml-1.5 font-normal">{label}</span>
      </div>
    );
  }

  return (
    <button type="button" onClick={onClick} className={cn("flex", !last && "mr-5")}>
      <strong className="font-bold">{formatCount(value)}</strong>
      <span className="ml-1.5 font-normal hover:underline">{label}</span>
    </button>
  );
}

function PillButton({
  children,
  primary,
  onClick,
}: {
  children: React.ReactNode;
  primary?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "h-11 rounded-full px-4 text-[16px] leading-[20.8px] font-semibold transition-colors",
        primary
          ? "bg-[var(--tt-red)] text-white hover:bg-[var(--tt-red-hover)]"
          : "bg-[var(--tt-field)] text-[var(--tt-icon)] hover:bg-[var(--tt-shape-neutral-3)]",
      )}
    >
      {children}
    </button>
  );
}

function IconButton({
  children,
  label,
  onClick,
}: {
  children: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className="flex h-11 w-11 flex-none items-center justify-center rounded-full bg-[var(--tt-field)] text-[var(--tt-icon)] transition-colors hover:bg-[var(--tt-shape-neutral-3)]"
    >
      {children}
    </button>
  );
}

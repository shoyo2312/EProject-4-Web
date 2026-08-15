"use client";

import Link from "next/link";
import { useRef, useState } from "react";

import { VerifiedBadgeIcon } from "@/components/icons";
import { useSession } from "@/components/session/SessionProvider";
import { cn } from "@/lib/utils";
import type { SuggestedCreator } from "@/types/tiktok";

/**
 * `.DivUserListWrapper` — the body of `/following`.
 *
 * The live page has two faces. For a viewer who already follows people it is a
 * vertical video feed identical to For You; for one who follows nobody — the
 * state the live site was measured in — the whole route is this grid of
 * creators to follow. That measured state is what this component reproduces.
 *
 * Measured on the live page (1440 / 1280 / 1024 / 820 / 700px):
 *   wrapper   736px wide, centred in the content column, capped at its width
 *             so it goes full-bleed below ~810px; 20px of padding above the
 *             first row, cards flowing left-to-right and wrapping
 *   gutters    18px between cards on both axes (card margin `0 18px 18px 0`)
 *   card       226 × 302, `border-radius: 8px`, `overflow: hidden`
 *   columns    3 while the column is wide enough, then 2, then 1 — the cards
 *              are a fixed width, so the count falls out of the wrap
 */
export function SuggestedCreators({
  creators,
}: {
  creators: SuggestedCreator[];
}) {
  return (
    <main className="h-screen flex-1 overflow-y-auto">
      <div className="mx-auto flex w-[736px] max-w-full flex-wrap content-start gap-[18px] pt-5 pb-[18px]">
        {creators.map((creator) => (
          <CreatorCard key={creator.id} creator={creator} />
        ))}
      </div>
    </main>
  );
}

/**
 * `.DivUserCard` — a cover frame that previews on hover, with the creator's
 * identity and a Follow button stacked over its lower two-thirds.
 *
 * The overlay carries no scrim on the live card: the text sits directly on the
 * poster, so it is reproduced that way rather than "improved" with a gradient.
 *
 * Internal geometry, all measured:
 *   info box   absolute, `top: 102px`, 200px tall, `padding: 30px 12px 20px`,
 *              flex column, centred, bottom-aligned
 *   avatar     48px disc, 14px below it
 *   name       18px/700, 24px line box
 *   handle     14px/600, 18px line box, 4px before the 12px badge
 *   button     164 × 37, `border-radius: 4px`, 8px below the handle, 18px/600
 */
function CreatorCard({ creator }: { creator: SuggestedCreator }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [following, setFollowing] = useState(creator.isFollowing);
  // Verified live signed out: Follow on these cards opens the login modal and
  // the card's own link does not fire.
  const { requireSignIn } = useSession();

  const preview = (playing: boolean) => {
    const video = videoRef.current;
    if (!video) return;
    if (playing) {
      // Autoplay can reject (e.g. reduced-power mode) — the poster stays up.
      void video.play().catch(() => {});
    } else {
      video.pause();
      video.currentTime = 0;
    }
  };

  return (
    <Link
      href={`/@${creator.author.username}`}
      onMouseEnter={() => preview(true)}
      onMouseLeave={() => preview(false)}
      className="relative block h-[302px] w-[226px] overflow-hidden rounded-[8px] bg-[#252525]"
    >
      {/* The live card holds a poster and, once hovered, a muted preview on top
          of it. One `<video>` with a `poster` does both — and, like the live
          preview, it plays through once rather than looping. */}
      <video
        ref={videoRef}
        src={creator.videoUrl}
        poster={creator.posterUrl}
        muted
        playsInline
        preload="none"
        className="absolute inset-0 h-full w-full object-cover"
      />

      {/* `.DivInfoContainer` */}
      <div className="absolute inset-x-0 top-[102px] flex h-[200px] flex-col items-center justify-end px-3 pt-[30px] pb-5 text-center">
        {/* eslint-disable-next-line @next/next/no-img-element -- local static asset, no optimisation needed */}
        <img
          src={creator.author.avatarUrl}
          alt=""
          className="mb-[14px] h-12 w-12 rounded-full bg-[rgb(136_136_136/0.5)] object-cover"
        />

        <h3 className="w-full truncate text-[18px] leading-[24px] font-bold text-white">
          {creator.author.nickname}
        </h3>

        <h4 className="flex max-w-full items-center justify-center gap-1 overflow-hidden text-[14px] leading-[18px] font-semibold text-white">
          <span className="truncate">{creator.author.username}</span>
          {creator.isVerified && (
            <VerifiedBadgeIcon className="h-3 w-3 flex-none" />
          )}
        </h4>

        {/* The button lives inside the card's link, so it has to swallow the
            navigation the way the live card's does. */}
        <button
          type="button"
          onClick={(event) => {
            event.preventDefault();
            if (!requireSignIn()) return;
            setFollowing((previous) => !previous);
          }}
          aria-pressed={following}
          className={cn(
            "mt-2 h-[37px] w-[164px] rounded-[4px] text-[18px] leading-[25px] font-semibold transition-colors",
            following
              ? "bg-[var(--tt-field)] text-white hover:bg-[var(--tt-shape-neutral-3)]"
              : "bg-[var(--tt-red-active)] text-white hover:bg-[var(--tt-red)]",
          )}
        >
          {following ? "Following" : "Follow"}
        </button>
      </div>
    </Link>
  );
}

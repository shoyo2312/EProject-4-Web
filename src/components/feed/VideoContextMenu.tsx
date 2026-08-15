"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";

import { ShareSheet } from "@/components/feed/ShareSheet";
import {
  AutoScrollIcon,
  CaptionsIcon,
  DownloadIcon,
  FloatingPlayerIcon,
  LinkIcon,
  QualityIcon,
  ShareIcon,
  SpeedIcon,
} from "@/components/icons";
import {
  MenuDivider,
  MenuRow,
  PlayerMenuPanel,
  QualityValue,
  SpeedPills,
  Switch,
} from "@/components/player/PlayerMenu";
import { usePlayerSettings } from "@/components/player/PlayerSettingsProvider";
import type { FeedVideo } from "@/types/tiktok";

/** Point the menu was summoned at, in the host card's coordinate space. */
export interface MenuAnchor {
  x: number;
  y: number;
}

/** Kept off the card's edges, matching the inset in the reference captures. */
const EDGE_MARGIN = 8;

/**
 * The feed's overflow menu, opened by right-clicking a card.
 *
 * There is no three-dot button in the feed's overlay — the menu is summoned by
 * the context menu, so it opens *at the pointer* rather than anchored to a
 * control. Since it is drawn inside the card (not over the page), the corner it
 * grows from depends on where in the card the click landed: near the right edge
 * it has to grow leftwards, near the bottom upwards, or it would be clipped.
 * That is `place()` below, and it is why the reference captures show the same
 * menu hanging off two different corners.
 */
export function VideoContextMenu({
  video,
  anchor,
  hostRef,
  onClose,
}: {
  video: FeedVideo;
  anchor: MenuAnchor;
  /** The card the menu is positioned inside — its box is the clamp. */
  hostRef: React.RefObject<HTMLElement | null>;
  onClose: () => void;
}) {
  const { speed, setSpeed, autoScroll, setAutoScroll } = usePlayerSettings();
  const menuRef = useRef<HTMLDivElement>(null);
  const [shareOpen, setShareOpen] = useState(false);

  /*
   * Written straight to the node rather than held in state: the menu's height
   * depends on its rendered rows, so the correction can only be computed once
   * it is in the DOM, and a layout effect is what lets that happen before the
   * browser paints — no visible jump from the raw click point to the clamped one.
   */
  useLayoutEffect(() => {
    const menu = menuRef.current;
    const host = hostRef.current;
    if (!menu || !host) return;

    const box = host.getBoundingClientRect();

    /*
     * A landscape card on a short viewport can be less tall than the menu, and
     * the card clips its own overflow — so cap the menu and let it scroll
     * rather than letting the bottom rows become unreachable.
     */
    menu.style.maxHeight = `${box.height - EDGE_MARGIN * 2}px`;

    const { width, height } = menu.getBoundingClientRect();
    menu.style.left = `${place(anchor.x, width, box.width)}px`;
    menu.style.top = `${place(anchor.y, height, box.height)}px`;
  }, [anchor, hostRef]);

  // Dismissed by a click anywhere else, by Escape, and by scrolling the feed
  // away — a menu pinned to a card that has scrolled off would be orphaned.
  useEffect(() => {
    if (shareOpen) return;

    const onPointerDown = (event: PointerEvent) => {
      /*
       * The secondary button is deliberately not a dismissal. Browsers disagree
       * on when `contextmenu` fires relative to `pointerdown` — before it on
       * macOS, after it elsewhere — so treating that press as an outside click
       * would race the gesture that is opening this very menu, and the menu
       * would flicker shut on the platforms that order it the other way. A
       * right-click that lands somewhere else is handled by `onContextMenu`
       * below instead.
       */
      if (event.button === 2) return;
      if (!menuRef.current?.contains(event.target as Node)) onClose();
    };
    /** A right-click outside the card dismisses; inside it, the card repositions. */
    const onContextMenu = (event: MouseEvent) => {
      if (!hostRef.current?.contains(event.target as Node)) onClose();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("contextmenu", onContextMenu);
    window.addEventListener("keydown", onKeyDown);
    // Capture, because the feed scrolls a container rather than the window.
    window.addEventListener("scroll", onClose, true);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("contextmenu", onContextMenu);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("scroll", onClose, true);
    };
  }, [onClose, hostRef, shareOpen]);

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(
        new URL(`/video/${video.id}`, window.location.origin).href,
      );
    } catch {
      // Denied (insecure origin, no permission) — nothing else to fall back to
      // here, unlike the detail page, which also shows the link in a field.
    }
    onClose();
  };

  return (
    <>
      <PlayerMenuPanel
        ref={menuRef}
        // `left`/`top` are placeholders until the layout effect corrects them.
        style={{ left: anchor.x, top: anchor.y }}
        className="no-scrollbar absolute z-40 overflow-y-auto"
      >
        {/* Not a button — the pills inside it are, and a button cannot nest. */}
        <MenuRow
          icon={<SpeedIcon className="h-5 w-5" />}
          label="Speed"
          trailing={<SpeedPills speed={speed} onSpeedChange={setSpeed} />}
        />

        <MenuRow
          icon={<QualityIcon className="h-5 w-5" />}
          label="Quality"
          trailing={<QualityValue />}
        />

        <MenuRow
          icon={<AutoScrollIcon className="h-5 w-5" />}
          label="Auto scroll"
          onClick={() => setAutoScroll(!autoScroll)}
          checked={autoScroll}
          trailing={<Switch on={autoScroll} />}
        />

        {/* Nothing behind these two in the clone — no PiP surface, and the mock
            feed carries no caption tracks — so they only dismiss. */}
        <MenuRow
          icon={<FloatingPlayerIcon className="h-5 w-5" />}
          label="Floating Player"
          onClick={onClose}
        />

        <MenuRow
          icon={<CaptionsIcon className="h-5 w-5" />}
          label="Captions"
          onClick={onClose}
        />

        <MenuDivider />

        <MenuRow
          icon={<DownloadIcon className="h-5 w-5" />}
          label="Download video"
          onClick={() => {
            download(video);
            onClose();
          }}
        />

        <MenuRow
          icon={<ShareIcon className="h-5 w-5" />}
          label="Share"
          onClick={() => setShareOpen(true)}
        />

        <MenuRow
          icon={<LinkIcon className="h-5 w-5" />}
          label="Copy link"
          onClick={copyLink}
        />
      </PlayerMenuPanel>

      {shareOpen && (
        <ShareSheet
          shares={video.stats.shares}
          onClose={() => {
            setShareOpen(false);
            onClose();
          }}
        />
      )}
    </>
  );
}

/**
 * Where one axis of the menu starts: at the click, pulled back inside the card
 * when it would overflow, and never past the near edge on a card too small to
 * hold it.
 */
function place(click: number, size: number, available: number) {
  const max = available - size - EDGE_MARGIN;
  return Math.max(EDGE_MARGIN, Math.min(click, max));
}

/**
 * Saves the file the card is playing. `download` only takes effect for
 * same-origin URLs, which every entry in the mock feed is (`/videos/*.mp4`).
 */
function download(video: FeedVideo) {
  if (!video.videoUrl) return;
  const link = document.createElement("a");
  link.href = video.videoUrl;
  link.download = video.videoUrl.split("/").pop() ?? "video.mp4";
  document.body.appendChild(link);
  link.click();
  link.remove();
}

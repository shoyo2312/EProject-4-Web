"use client";

import { useState } from "react";

import { ImageLightbox } from "@/components/messages/thread/ImageLightbox";
import { useChatImage } from "@/hooks/use-chat-image";
import type { ImageView } from "@/lib/api/conversations";
import { fitImage } from "@/lib/chat-image";

/** The most a picture may take of the thread: its width, and a height that keeps a tall one on screen. */
const MAX_WIDTH = 280;
const MAX_HEIGHT = 360;

/**
 * A picture in a message. The box is sized from the server's width and height before anything is
 * fetched, so the thread does not shift when the bytes arrive; it shows a placeholder meanwhile and a
 * retry when the fetch fails. Pressing it opens the viewer.
 */
export function ImageMessage({ image }: { image: ImageView | null | undefined }) {
  const loaded = useChatImage(image);
  const [open, setOpen] = useState(false);

  if (!image) {
    return (
      <div className="flex h-24 w-48 items-center justify-center rounded-[var(--chat-radius-bubble)] border border-[var(--chat-line)] text-[13px] text-[var(--chat-meta)] italic">
        Photo unavailable
      </div>
    );
  }
  const box = fitImage(image.width, image.height, MAX_WIDTH, MAX_HEIGHT);

  return (
    <>
      <div
        data-image-box
        style={{ width: box.width, aspectRatio: `${box.width} / ${box.height}` }}
        className="relative max-w-full overflow-hidden rounded-[var(--chat-radius-bubble)] bg-[var(--chat-raised)]"
      >
        {loaded.status === "ready" ? (
          <button
            type="button"
            onClick={() => setOpen(true)}
            aria-label="Open photo"
            className="block h-full w-full cursor-zoom-in focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-white/70"
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- an object URL made from an authenticated fetch; next/image cannot load it */}
            <img src={loaded.src} alt="Photo" draggable={false} className="h-full w-full object-cover" />
          </button>
        ) : loaded.status === "error" ? (
          <div className="flex h-full w-full flex-col items-center justify-center gap-2 px-3 text-center text-[13px] text-[var(--chat-meta)]">
            <span>Couldn&apos;t load photo</span>
            <button
              type="button"
              onClick={loaded.retry}
              className="rounded-full bg-white/10 px-3 py-1 text-[12.5px] font-semibold text-[var(--tt-text)] hover:bg-white/20 focus-visible:outline-2 focus-visible:outline-white/70"
            >
              Retry
            </button>
          </div>
        ) : (
          <div
            role="status"
            aria-label="Loading photo"
            className="h-full w-full animate-pulse bg-white/[0.06] motion-reduce:animate-none"
          />
        )}
      </div>
      {open && loaded.status === "ready" && <ImageLightbox src={loaded.src} onClose={() => setOpen(false)} />}
    </>
  );
}

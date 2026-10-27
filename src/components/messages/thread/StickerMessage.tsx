"use client";

import { useState } from "react";

import type { StickerView } from "@/lib/api/conversations";

/**
 * A sticker in the history: the picture on its own, no bubble. The box has a fixed size before the
 * image has loaded, so a sticker arriving never moves what the reader is looking at. If the picture
 * does not load — or the catalog no longer knows the id — the same box says so.
 */
export function StickerMessage({ sticker }: { sticker: StickerView | null }) {
  const [failed, setFailed] = useState<string | null>(null);
  const broken = !sticker || failed === sticker.url;

  return (
    <div className="h-32 w-32 flex-none">
      {broken ? (
        <div
          role="img"
          aria-label="Sticker unavailable"
          className="flex h-full w-full items-center justify-center rounded-[18px] bg-[var(--tt-field)] px-3 text-center text-[12px] leading-4 text-[var(--tt-text-muted)]"
        >
          Sticker unavailable
        </div>
      ) : (
        // eslint-disable-next-line @next/next/no-img-element -- a fixed-size public image from the media store; next/image would need its host allow-listed
        <img
          src={sticker.url}
          alt={sticker.name}
          width={sticker.width}
          height={sticker.height}
          decoding="async"
          onError={() => setFailed(sticker.url)}
          className="h-full w-full object-contain"
        />
      )}
    </div>
  );
}

"use client";

import type { VideoStatus } from "@/lib/api/types";

/**
 * What became of the last post, shown over the empty drop zone.
 *
 * A banner rather than a toast because this is the only place the reason is
 * ever said: the video is already on the profile in whatever state the verdict
 * left it, and the uploader's next move — pick a different file, or go contact
 * support — depends on reading it. It clears when a new file is chosen.
 */
export function Outcome({ status, message }: { status: VideoStatus; message: string }) {
  const bad = status === "REJECTED" || status === "FAILED" || status === "TAKEN_DOWN";
  return (
    <div
      role="status"
      className={`mb-6 rounded-[4px] border px-4 py-3 text-[14px] leading-5 ${
        bad
          ? "border-[var(--tt-red-active)]/40 bg-[var(--tt-red-active)]/10 text-[var(--tt-text)]"
          : "border-white/[0.12] bg-white/[0.06] text-[var(--tt-text)]"
      }`}
    >
      {message}
    </div>
  );
}

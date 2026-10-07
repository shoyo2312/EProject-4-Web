"use client";

import { useRef } from "react";

import { formatBytes } from "@/lib/format";

/** The chosen file, played back in a phone-shaped frame like Studio's preview. */
export function Preview({
  accept,
  file,
  url,
  progress,
  processing,
  onReplace,
  disabled,
}: {
  accept: string;
  file: File;
  url: string | null;
  progress: number | null;
  processing: boolean;
  onReplace: (file: File | null) => void;
  disabled: boolean;
}) {
  const input = useRef<HTMLInputElement>(null);
  /**
   * One bar for both halves of the wait. The POST is the only part with real
   * bytes to count, so it owns 0–90%; transcoding has no progress to report
   * and holds a pulsing 90% until it finishes, at which point the page is
   * already navigating away.
   */
  const percent = processing
    ? 90
    : progress === null
      ? 0
      : Math.round(progress * 90);
  const label = processing
    ? "Processing your video…"
    : percent < 90
      ? `Uploading… ${Math.round(percent / 0.9)}%`
      : "Uploaded — posting…";

  return (
    <div className="w-full shrink-0 lg:w-[280px]">
      <div className="aspect-[9/16] w-full overflow-hidden rounded-[8px] bg-black">
        {url && (
          <video
            src={url}
            controls
            muted
            playsInline
            className="h-full w-full object-contain"
          />
        )}
      </div>

      <p className="mt-3 truncate text-[14px] font-semibold text-[var(--tt-text)]">
        {file.name}
      </p>
      <p className="text-[13px] text-[var(--tt-text-secondary)]">
        {formatBytes(file.size)}
      </p>

      {(progress !== null || processing) && (
        <div className="mt-3">
          <div
            role="progressbar"
            aria-label="Upload progress"
            aria-valuenow={percent}
            aria-valuemin={0}
            aria-valuemax={100}
            className="h-1.5 w-full overflow-hidden rounded-full bg-white/[0.12]"
          >
            <div
              className={`h-full bg-[var(--tt-red-active)] transition-[width] duration-200 ${
                processing ? "animate-pulse" : ""
              }`}
              style={{ width: `${percent}%` }}
            />
          </div>
          <p className="mt-1.5 text-[13px] text-[var(--tt-text-secondary)]">
            {label}
          </p>
        </div>
      )}

      <input
        ref={input}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(event) => onReplace(event.target.files?.[0] ?? null)}
      />
      <button
        type="button"
        disabled={disabled}
        onClick={() => input.current?.click()}
        className="mt-3 h-9 w-full rounded-[4px] bg-white/[0.12] text-[14px] font-semibold text-[var(--tt-text)] disabled:text-white/[0.34]"
      >
        Replace video
      </button>
    </div>
  );
}

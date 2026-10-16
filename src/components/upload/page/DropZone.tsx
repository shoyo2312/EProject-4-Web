"use client";

import { useRef, useState } from "react";

/**
 * The click-or-drag target. `dragCounter` rather than a boolean because
 * `dragleave` fires when the pointer crosses onto a *child* of the zone, and a
 * boolean flickers the highlight off every time the cursor passes the icon.
 */
export function DropZone({
  accept,
  onFile,
  error,
}: {
  accept: string;
  onFile: (file: File | null) => void;
  error: string | null;
}) {
  const input = useRef<HTMLInputElement>(null);
  const dragCounter = useRef(0);
  const [dragging, setDragging] = useState(false);

  return (
    <div
      onDragEnter={(event) => {
        event.preventDefault();
        dragCounter.current += 1;
        setDragging(true);
      }}
      onDragOver={(event) => event.preventDefault()}
      onDragLeave={() => {
        dragCounter.current -= 1;
        if (dragCounter.current <= 0) setDragging(false);
      }}
      onDrop={(event) => {
        event.preventDefault();
        dragCounter.current = 0;
        setDragging(false);
        onFile(event.dataTransfer.files[0] ?? null);
      }}
      className={`flex flex-col items-center justify-center rounded-[8px] border-2 border-dashed px-6 py-20 text-center ${
        dragging
          ? "border-[var(--tt-red-active)] bg-white/[0.06]"
          : "border-white/20 bg-white/[0.03]"
      }`}
    >
      <input
        ref={input}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(event) => onFile(event.target.files?.[0] ?? null)}
      />

      <CloudIcon />

      <p className="mt-4 text-[18px] leading-6 font-semibold text-[var(--tt-text)]">
        Select video to upload
      </p>
      <p className="mt-1 text-[14px] leading-5 text-[var(--tt-text-secondary)]">
        Or drag and drop it here
      </p>

      <button
        type="button"
        onClick={() => input.current?.click()}
        className="mt-6 h-11 rounded-[4px] bg-[var(--tt-red-active)] px-8 text-[15px] font-semibold text-white"
      >
        Select video
      </button>

      {error && (
        <p role="alert" className="mt-4 text-[14px] text-[var(--tt-red-active)]">
          {error}
        </p>
      )}

      <dl className="mt-10 grid gap-6 text-left sm:grid-cols-3">
        <Fact term="Size and duration">
          Up to 500 MB and 10 minutes.
        </Fact>
        <Fact term="File formats">
          MP4, MOV and WebM — the formats the transcoder can read.
        </Fact>
        <Fact term="After posting">
          It stays off the feed until transcoding finishes, which is watched
          here.
        </Fact>
      </dl>
    </div>
  );
}

function Fact({ term, children }: { term: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-[14px] leading-5 font-semibold text-[var(--tt-text)]">
        {term}
      </dt>
      <dd className="mt-1 text-[13px] leading-[18px] text-[var(--tt-text-secondary)]">
        {children}
      </dd>
    </div>
  );
}

function CloudIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden
      className="h-12 w-12 text-[var(--tt-text-secondary)]"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 16V4m0 0L8 8m4-4 4 4" />
      <path d="M4 14v3a3 3 0 0 0 3 3h10a3 3 0 0 0 3-3v-3" />
    </svg>
  );
}

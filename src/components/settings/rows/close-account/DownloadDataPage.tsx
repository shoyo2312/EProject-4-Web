"use client";

import { useState } from "react";

import { CheckboxTickIcon } from "@/components/icons";
import { cn } from "@/lib/utils";

/**
 * "Download your data" — the last page before a delete is confirmed, as live.
 * "Request download" opens the "Download your data" page, as live.
 *
 * Measured live at 1920px:
 *   body      `padding: 24px 32px 0`; title 20/25/700 `.9` + 16, paragraphs
 *             14/18.2 `.75` + 16, link 14/18.2/500 rgb(96,179,255)
 *   footer    `padding: 16px 24px 24px`; a round 16px checkbox ringed
 *             `1px rgba(255,255,255,.32)`, #FE2C55 with a white tick once
 *             checked, 8 before its 15/19.5 `.75` label; the 632 × 40
 *             button, radius 6, 16/20.8/500 on #FE2C55 at `.4` until checked,
 *             16 below
 */
export function DownloadDataPage({
  onRequestDownload,
  onConfirm,
}: {
  onRequestDownload: () => void;
  onConfirm: () => void;
}) {
  const [reviewed, setReviewed] = useState(false);

  return (
    <>
      <div className="flex-1 px-8 pt-6">
        <h1 className="mb-4 text-[20px] leading-[25px] font-bold text-[rgb(255_255_255/0.9)]">
          Download your Nowa data
        </h1>
        <div className="text-[14px] leading-[18.2px] text-[rgb(255_255_255/0.75)]">
          <p className="pb-4">
            We recommend downloading your Nowa data (like your video posts) because you can no
            longer download it once you delete your account. You won&rsquo;t be able to download
            content that is not stored in Nowa servers, such as your drafts.
          </p>
          <p className="pb-4">
            If you already requested a copy of your data, wait until you download it before
            deleting your account.
          </p>
        </div>
        <button
          type="button"
          onClick={onRequestDownload}
          className="text-[14px] leading-[18.2px] font-medium text-[rgb(96_179_255)]"
        >
          Request download
        </button>
      </div>

      <div className="px-6 pt-4 pb-6">
        <label className="flex cursor-pointer items-center">
          <span className="relative mr-2 flex h-4 w-4 flex-none">
            <input
              type="checkbox"
              checked={reviewed}
              onChange={(event) => setReviewed(event.target.checked)}
              className="peer absolute inset-0 cursor-pointer opacity-0"
            />
            <span
              className={cn(
                "flex h-full w-full items-center justify-center rounded-full text-white peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-white",
                reviewed ? "bg-[var(--tt-red)]" : "border border-[rgb(255_255_255/0.32)]",
              )}
            >
              {reviewed && <CheckboxTickIcon className="h-4 w-4" />}
            </span>
          </span>
          <span className="text-[15px] leading-[19.5px] text-[rgb(255_255_255/0.75)]">
            By continuing, you reviewed your data request and wish to continue deleting your
            account
          </span>
        </label>
        <button
          type="button"
          onClick={onConfirm}
          disabled={!reviewed}
          className="mt-4 h-10 w-full rounded-[6px] bg-[var(--tt-red)] px-4 text-[16px] leading-[20.8px] font-medium text-white transition-colors enabled:hover:bg-[var(--tt-red-hover)] disabled:cursor-not-allowed disabled:opacity-40"
        >
          Continue
        </button>
      </div>
    </>
  );
}

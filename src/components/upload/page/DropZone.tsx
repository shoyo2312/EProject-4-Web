"use client";

import { FolderClosed, Proportions, ScanEye, Video } from "lucide-react";
import { useRef, useState } from "react";

import { cn } from "@/lib/utils";

/** The live page's four hints, with video-service's own limits in place of TikTok's 30 GB / 60 min. */
const FACTS = [
  { icon: Video, term: "Size and duration", text: "Max size: 500 MB, video duration: 10 minutes." },
  { icon: FolderClosed, term: "File formats", text: "Recommended: “.mp4”. Also “.mov”, “.webm”." },
  { icon: ScanEye, term: "Video resolutions", text: "High-resolution recommended: 1080p, 1440p, 4K." },
  { icon: Proportions, term: "Aspect ratios", text: "Recommended: 16:9 landscape, 9:16 vertical." },
] as const;

/**
 * The empty upload card, measured off tiktok.com/tiktokstudio/upload: a white
 * 8px card whose 60px tab row sits over a 1px `rgba(0,0,0,.12)` rule, then a
 * 380px dashed drop target and the four-column hint strip, all inside 20px.
 *
 * The whole target opens the picker, as the live one does. `dragCounter`
 * rather than a boolean because `dragleave` fires when the pointer crosses
 * onto a *child* of the zone, and a boolean flickers the highlight off.
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
    <section className="rounded-[8px] border border-black/8 bg-white">
      {/* Photo posts have no backend, so Video is the only tab. */}
      <div className="flex h-[60px] items-stretch pl-5">
        <span className="flex items-center border-b-2 border-black text-[16px] leading-5 font-semibold">
          Video
        </span>
      </div>

      <div className="border-t border-black/12 p-5">
        {/* Outside the target: a click on the input would bubble back into it. */}
        <input
          ref={input}
          type="file"
          accept={accept}
          className="hidden"
          onChange={(event) => {
            onFile(event.target.files?.[0] ?? null);
            event.target.value = "";
          }}
        />
        <div
          onClick={() => input.current?.click()}
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
          className={cn(
            "flex h-[380px] cursor-pointer flex-col items-center justify-center rounded-[8px] border border-dashed text-center transition-colors",
            dragging ? "border-[#fe2c55] bg-[#fe2c55]/5" : "border-black/8 bg-black/5 hover:border-black/20",
          )}
        >
          <UploadArt />
          <p className="mt-3 text-[18px] leading-[23px] font-bold text-black">Select video to upload</p>
          <p className="mt-[5px] text-[14px] leading-[18px] text-black/48">Or drag and drop it here</p>
          <button
            type="button"
            className="mt-5 h-9 w-[270px] rounded-[8px] bg-[#fe2c55] px-3 text-[14px] leading-5 font-medium text-white transition-colors hover:bg-[#ea284e]"
          >
            Select video
          </button>
          {error && (
            <p role="alert" className="mt-3 text-[13px] leading-[17px] text-[#fe2c55]">
              {error}
            </p>
          )}
        </div>

        <ul className="mt-5 flex px-6 py-3">
          {FACTS.map(({ icon: Icon, term, text }) => (
            <li key={term} className="flex flex-1 gap-2 pr-6">
              <Icon className="h-5 w-5 flex-none" strokeWidth={1.75} />
              <div>
                <p className="text-[16px] leading-[21px] font-bold text-black">{term}</p>
                <p className="mt-1 text-[13px] leading-[17px] text-black/48">{text}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

/** Stand-in for the live 72px illustration: a stack of grey clips and an upload badge. */
function UploadArt() {
  return (
    <svg viewBox="0 0 72 72" aria-hidden className="h-[72px] w-[72px]">
      <rect x="22" y="12" width="34" height="44" rx="5" fill="#d0d0d0" transform="rotate(10 39 34)" />
      <rect x="12" y="14" width="36" height="46" rx="5" fill="#b8b8b8" />
      <path d="M25 29v16l13-8z" fill="#fff" />
      <circle cx="50" cy="50" r="13" fill="#e3e3e3" stroke="#fff" strokeWidth="2" />
      <path d="M50 57V44m0 0-5 5m5-5 5 5" fill="none" stroke="#8a8a8a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

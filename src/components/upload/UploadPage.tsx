"use client";

import { ChevronDown, CircleCheck, RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { useSession } from "@/components/session/SessionProvider";
import { toast } from "@/components/ui/toast";
import { DropZone } from "@/components/upload/page/DropZone";
import { CaptionField } from "@/components/upload/page/Fields";
import { Preview } from "@/components/upload/page/Preview";
import { isApiError, messageFor, retryAt } from "@/lib/api/errors";
import type { VideoVisibility } from "@/lib/api/types";
import {
  ACCEPTED_UPLOAD_TYPES,
  createUploadUrl,
  createVideo,
  updateVideoCommentsSetting,
  uploadToStorage,
} from "@/lib/api/videos";
import { formatBytes, formatDateTime } from "@/lib/format";
import { UPLOAD_LIMITS, uploadSchema } from "@/lib/forms/schemas";
import { useForm } from "@/lib/forms/use-form";
import { cn } from "@/lib/utils";

/**
 * `/studio/upload` — TikTok Studio's upload page, measured off the live one,
 * minus what has no backend here: edit / sound / text, location, schedule,
 * HQ upload, content disclosure, AI label, audience controls and the checks.
 *
 * Three hops, because the bytes never go through the API:
 *
 *   1. `POST /videos/upload-url` presigns a multipart POST into object storage;
 *   2. the browser POSTs the file straight there (progress comes from XHR);
 *   3. `POST /videos` publishes it with the `s3://` location step 1 handed back.
 *
 * Then, as on the live site, it goes straight to `/studio/content`: the post
 * is listed there with its status while it transcodes and is checked, so this
 * page has nothing left to wait for.
 *
 * Only step 3 creates anything, so a page closed mid-upload leaves an orphan
 * object the bucket's lifecycle rule expires — nothing to clean up here.
 */

/** video-service refuses anything else, and would only do so after the upload. */
const ACCEPT = ACCEPTED_UPLOAD_TYPES.join(",");

/**
 * The field a caption refused at publish belongs under. Tags only come from
 * the description's hashtags, so they answer there.
 */
const CAPTION_FIELD: Record<string, "title" | "description"> = {
  VIDEO_TITLE_REJECTED: "title",
  VIDEO_DESCRIPTION_REJECTED: "description",
  VIDEO_TAGS_REJECTED: "description",
};

const VISIBILITY: { value: VideoVisibility; label: string }[] = [
  { value: "PUBLIC", label: "Everyone" },
  { value: "FRIENDS", label: "Friends" },
  { value: "PRIVATE", label: "Only you" },
];

const SECTION = "rounded-[8px] border border-black/8 bg-white";
const HEADING = "text-[16px] leading-[21px] font-bold text-black";
const LABEL = "block text-[14px] leading-[21px] font-medium text-black";

export function UploadPage() {
  const { user } = useSession();
  const router = useRouter();

  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  /** "720P" and the like, off the shorter side once the cover has read the metadata. */
  const [resolution, setResolution] = useState<string | null>(null);
  const [allowComments, setAllowComments] = useState(true);
  const [showMore, setShowMore] = useState(false);
  /** 0–1 while the POST runs, null otherwise — it is also what drives the bar. */
  const [progress, setProgress] = useState<number | null>(null);

  /**
   * The upload outlives its handler, so unmounting is what stops it. Made **per submit**: StrictMode's dev remount aborts a controller
   * created up front, and an aborted controller cannot be reset.
   */
  const abort = useRef<AbortController | null>(null);
  useEffect(() => () => abort.current?.abort(), []);

  /**
   * The file already in storage and where it landed. A caption refused at
   * publish stores nothing, so Post after the fix publishes these same bytes.
   */
  const uploaded = useRef<{ file: File; fileUrl: string } | null>(null);

  /** When Post works again after `UPLOAD_RATE_LIMITED`; null while it does. */
  const [postAgainAt, setPostAgainAt] = useState<Date | null>(null);
  useEffect(() => {
    if (!postAgainAt) return;
    const id = window.setTimeout(() => setPostAgainAt(null), postAgainAt.getTime() - Date.now());
    return () => window.clearTimeout(id);
  }, [postAgainAt]);

  /** The bytes are on their way, or the post is being made — the stretch a reload would lose. */
  const uploading = progress !== null;

  // A reload or a closed tab mid-upload throws the transfer away — ask first.
  useEffect(() => {
    if (!uploading) return;
    const onBeforeUnload = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [uploading]);

  // A leaked object URL pins the whole file in memory for as long as the tab lives.
  useEffect(() => {
    if (!previewUrl) return;
    return () => URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  const form = useForm({
    schema: uploadSchema,
    initialValues: {
      title: "",
      description: "",
      visibility: "PUBLIC" as VideoVisibility,
    },
    onSubmit: async (values, { setFieldError }) => {
      if (!file) {
        toast.error("Choose a video file first.");
        return;
      }

      const controller = new AbortController();
      abort.current = controller;
      const { signal } = controller;
      let fileUrl = uploaded.current?.file === file ? uploaded.current.fileUrl : null;
      setProgress(fileUrl ? 1 : 0);
      try {
        if (!fileUrl) {
          const target = await createUploadUrl({ contentType: file.type });
          await uploadToStorage(target.uploadUrl, file, target.formFields, setProgress, signal);
          fileUrl = target.fileUrl;
          uploaded.current = { file, fileUrl };
        }

        const created = await createVideo({
          title: values.title.trim(),
          description: values.description.trim() || undefined,
          rawFileUrl: fileUrl,
          visibility: values.visibility,
        });
        uploaded.current = null;

        // Comments are a setting on the video, not a field of the post, so
        // they go off in a second call. The post already exists either way.
        if (!allowComments) {
          await updateVideoCommentsSetting(created.id, true).catch(() =>
            toast.error("Posted, but comments are still on. Turn them off from Posts."),
          );
        }

        // `submitting` stays true until the page is gone, so Post cannot fire twice.
        toast.success("Video posted. It will go live once processing finishes.");
        router.replace("/studio/content");
      } catch (cause) {
        // An abort is the page going away, not a failure to report.
        setProgress(null);
        if (signal.aborted) return;
        const again = isApiError(cause) && cause.is("UPLOAD_RATE_LIMITED") ? retryAt(cause) : null;
        if (again) {
          setPostAgainAt(again);
          return;
        }
        const field = isApiError(cause) ? CAPTION_FIELD[cause.code ?? ""] : undefined;
        if (field) {
          setFieldError(field, messageFor(cause));
          return;
        }
        // `useForm` turns this into an error toast.
        throw cause;
      }
    },
  });

  function clearFile() {
    setFile(null);
    setPreviewUrl(null);
    setResolution(null);
  }

  async function chooseFile(next: File | null) {
    if (!next) return;
    if (!ACCEPTED_UPLOAD_TYPES.includes(next.type as never)) {
      setFileError("That file isn’t a supported video. Use MP4, MOV or WebM.");
      return;
    }
    if (next.size > UPLOAD_LIMITS.maxBytes) {
      setFileError("That file is over 500 MB.");
      return;
    }

    // Best effort over a server backstop: the browser cannot decode every
    // accepted container (an iPhone HEVC .mov fails here but transcodes fine),
    // so only a duration actually measured over the limit blocks the upload.
    let seconds: number | null = null;
    try {
      seconds = await readDuration(next);
    } catch {
      // undecodable here ≠ undecodable server-side; media-worker is the judge.
    }
    if (seconds !== null && seconds > UPLOAD_LIMITS.maxSeconds) {
      setFileError("That video is longer than 10 minutes.");
      return;
    }

    setFileError(null);
    setResolution(null);
    setFile(next);
    setPreviewUrl(URL.createObjectURL(next));
    // Same courtesy the real Studio does: the filename is a usable first title.
    if (!form.values.title) {
      form.setValue("title", [...next.name.replace(/\.[^.]+$/, "")].slice(0, UPLOAD_LIMITS.title).join(""));
    }
  }

  if (!user) return null;

  if (!file || !previewUrl) {
    return (
      <div className="px-8">
        <DropZone accept={ACCEPT} onFile={chooseFile} error={fileError} />
      </div>
    );
  }

  const caption = [form.values.title, form.values.description].filter(Boolean).join(" ");

  return (
    <form onSubmit={form.handleSubmit} noValidate className="px-8">
      <FileCard
        file={file}
        resolution={resolution}
        progress={progress}
        error={fileError}
        disabled={form.submitting}
        onReplace={chooseFile}
      />

      <div className="mt-8 flex flex-col gap-6 lg:flex-row">
        <div className="min-w-0 flex-1">
          <h2 className={HEADING}>Details</h2>
          <div className={cn(SECTION, "mt-4 flex flex-col gap-7 p-5")}>
            <CaptionField
              {...form.field("title")}
              label="Title"
              max={UPLOAD_LIMITS.title}
              placeholder="Give it a title"
            />
            <CaptionField
              {...form.field("description")}
              label="Description"
              max={UPLOAD_LIMITS.description}
              placeholder="Share more about your video here. #hashtags become tags."
              multiline
            />
            <div>
              <span className={LABEL}>Cover</span>
              {/* media-worker picks the thumbnail; this is the frame it starts from. */}
              <video
                src={`${previewUrl}#t=0.1`}
                muted
                playsInline
                preload="metadata"
                onLoadedMetadata={(event) => {
                  const { videoWidth, videoHeight } = event.currentTarget;
                  if (videoWidth && videoHeight) setResolution(`${Math.min(videoWidth, videoHeight)}P`);
                }}
                className="mt-3 h-[176px] w-[132px] rounded-[8px] bg-black/5 object-cover"
              />
            </div>
          </div>

          <h2 className={cn(HEADING, "mt-8")}>Settings</h2>
          <div className={cn(SECTION, "mt-4 overflow-hidden")}>
            <div className="flex flex-col gap-6 p-5">
              <div>
                <label htmlFor="upload-visibility" className={LABEL}>
                  Who can watch this video
                </label>
                <div className="relative mt-3 w-[280px]">
                  <select
                    id="upload-visibility"
                    value={form.values.visibility}
                    onChange={(event) => form.setValue("visibility", event.target.value as VideoVisibility)}
                    className="h-9 w-full cursor-pointer appearance-none rounded-[8px] bg-black/5 pr-9 pl-3 text-[14px] text-black outline-none focus-visible:ring-1 focus-visible:ring-black/20"
                  >
                    {VISIBILITY.map(({ value, label }) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="pointer-events-none absolute top-2.5 right-3 h-4 w-4" strokeWidth={2} />
                </div>
              </div>

              {showMore && (
                <div>
                  <span className={LABEL}>Allow users to:</span>
                  <label className="mt-2.5 flex w-fit cursor-pointer items-center gap-2 text-[14px] leading-[21px] text-black">
                    <input
                      type="checkbox"
                      checked={allowComments}
                      onChange={(event) => setAllowComments(event.target.checked)}
                      className="h-4 w-4 cursor-pointer accent-[#fe2c55]"
                    />
                    Comment
                  </label>
                </div>
              )}
            </div>
            <button
              type="button"
              aria-expanded={showMore}
              onClick={() => setShowMore((open) => !open)}
              className="flex h-11 w-full items-center justify-center gap-1 border-t border-black/8 text-[14px] leading-[18px] font-medium text-black hover:bg-black/3"
            >
              {showMore ? "Show less" : "Show more"}
              <ChevronDown className={cn("h-4 w-4 transition-transform", showMore && "rotate-180")} strokeWidth={2} />
            </button>
          </div>

          <div className="mt-8 flex gap-2">
            <button
              type="submit"
              disabled={form.submitting || postAgainAt !== null}
              className="h-9 w-[200px] rounded-[8px] bg-[#fe2c55] px-3 text-[14px] leading-5 font-medium text-white transition-colors hover:bg-[#ea284e] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {form.submitting ? "Posting…" : "Post"}
            </button>
            <button
              type="button"
              disabled={form.submitting && !uploading}
              onClick={() => {
                // Mid-upload this stops the transfer and keeps the file and
                // fields, so Post retries it; otherwise it drops the file.
                if (uploading) {
                  abort.current?.abort();
                  toast.success("Upload canceled.");
                  return;
                }
                clearFile();
              }}
              className="h-9 rounded-[8px] bg-black/5 px-3 text-[14px] leading-5 font-medium text-black transition-colors hover:bg-black/8 disabled:cursor-not-allowed disabled:text-black/34"
            >
              {uploading ? "Cancel" : "Discard"}
            </button>
          </div>
          {postAgainAt && (
            <p className="mt-3 text-[14px] leading-5 text-black/65">
              You’ve reached the posting limit for now. You can post again on {formatDateTime(postAgainAt)}.
            </p>
          )}
        </div>

        <aside className="flex-none lg:mt-[37px] lg:w-[288px]">
          <Preview url={previewUrl} caption={caption} author={{ name: user.nickname, avatarUrl: user.avatarUrl }} />
        </aside>
      </div>
    </form>
  );
}

/**
 * The live page's top card: filename at 16/700 with a 10px resolution badge,
 * a 14px status line, Replace at the top right, and a 4px bar along the bottom
 * edge in the live `#0be09b`.
 */
function FileCard({
  file,
  resolution,
  progress,
  error,
  disabled,
  onReplace,
}: {
  file: File;
  resolution: string | null;
  progress: number | null;
  error: string | null;
  disabled: boolean;
  onReplace: (file: File | null) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const percent = progress === null ? null : Math.round(progress * 100);
  const done = percent === 100;

  return (
    <section className={cn(SECTION, "relative overflow-hidden py-[27px] pr-[136px] pl-5")}>
      <p className="flex items-center gap-3">
        <span className="truncate text-[16px] leading-[21px] font-bold text-black">{file.name}</span>
        {resolution && (
          <span className="flex h-5 flex-none items-center rounded-[4px] border border-black/12 px-1 text-[10px] font-medium text-black">
            {resolution}
          </span>
        )}
      </p>
      <p
        className={cn(
          "mt-[9px] flex items-center gap-1 text-[14px] leading-[18px]",
          error ? "text-[#fe2c55]" : done ? "text-[#008568]" : "text-black/48",
        )}
      >
        {error ? (
          error
        ) : done ? (
          <>
            <CircleCheck className="h-4 w-4" strokeWidth={2} />
            Uploaded ({formatBytes(file.size)})
          </>
        ) : percent !== null ? (
          `Uploading… ${percent}%`
        ) : (
          `Ready to post (${formatBytes(file.size)})`
        )}
      </p>

      <input
        ref={input}
        type="file"
        accept={ACCEPT}
        className="hidden"
        onChange={(event) => {
          onReplace(event.target.files?.[0] ?? null);
          event.target.value = "";
        }}
      />
      <button
        type="button"
        disabled={disabled}
        onClick={() => input.current?.click()}
        className="absolute top-4 right-4 flex h-9 items-center gap-1 rounded-[8px] bg-black/5 px-3 text-[14px] leading-5 font-medium text-black transition-colors hover:bg-black/8 disabled:cursor-not-allowed disabled:text-black/34"
      >
        <RefreshCw className="h-4 w-4" strokeWidth={2} />
        Replace
      </button>

      {percent !== null && (
        <progress
          value={percent}
          max={100}
          aria-label="Upload progress"
          className={cn(
            "absolute inset-x-0 bottom-0 block h-1 w-full appearance-none bg-transparent",
            "[&::-webkit-progress-bar]:bg-transparent [&::-webkit-progress-value]:bg-[#0be09b] [&::-webkit-progress-value]:transition-[width]",
            "[&::-moz-progress-bar]:bg-[#0be09b]",
          )}
        />
      )}
    </section>
  );
}

/** Reads a video file's length via a detached media element. Rejects if it has none. */
function readDuration(file: File): Promise<number> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const probe = document.createElement("video");
    probe.preload = "metadata";
    probe.onloadedmetadata = () => {
      URL.revokeObjectURL(url);
      const seconds = probe.duration;
      if (Number.isFinite(seconds)) resolve(seconds);
      else reject(new Error("no-duration"));
    };
    probe.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("not-media"));
    };
    probe.src = url;
  });
}

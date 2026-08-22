"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { useSession } from "@/components/session/SessionProvider";
import { Skeleton } from "@/components/ui/skeleton";
import type { VideoResponse, VideoVisibility } from "@/lib/api/types";
import {
  ACCEPTED_UPLOAD_TYPES,
  createUploadUrl,
  createVideo,
  pollUntilReady,
  uploadToStorage,
} from "@/lib/api/videos";
import { uploadSchema } from "@/lib/forms/schemas";
import { useForm } from "@/lib/forms/use-form";

/**
 * `/upload` — pick a video file and post it, the way TikTok Studio does.
 *
 * Three hops, because the bytes never go through the API:
 *
 *   1. `POST /videos/upload-url` presigns a PUT into object storage;
 *   2. the browser PUTs the file straight there (progress comes from XHR);
 *   3. `POST /videos` publishes it with the `s3://` location step 1 handed back.
 *
 * Only step 3 creates anything, so a page closed mid-upload leaves an orphan
 * object the bucket's lifecycle rule expires — nothing to clean up here.
 */

/** video-service refuses anything else, and would only do so after the upload. */
const ACCEPT = ACCEPTED_UPLOAD_TYPES.join(",");
const MAX_BYTES = 2 * 1024 * 1024 * 1024;

export function UploadPage() {
  const { user, isLoading, openLogin } = useSession();
  const router = useRouter();

  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  /** 0–1 while the PUT runs, null otherwise — it is also what drives the bar. */
  const [progress, setProgress] = useState<number | null>(null);
  const [video, setVideo] = useState<VideoResponse | null>(null);

  /**
   * Both the upload and the poll outlive their handler, so unmounting is what
   * stops them. The controller is made **per submit**, never up front: React
   * StrictMode mounts, unmounts and remounts in dev, so a controller created in
   * the ref initialiser is already aborted by the time anything uses it — and
   * an aborted controller cannot be reset. That was an upload stuck on
   * "Uploading… 0%" forever, because the PUT was cancelled before it was sent.
   */
  const abort = useRef<AbortController | null>(null);
  useEffect(() => () => abort.current?.abort(), []);

  // The object URL is the preview's source; letting it leak pins the whole file
  // in memory for as long as the tab lives.
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
    onSubmit: async (values, { setFormError }) => {
      if (!file) {
        setFormError("Choose a video file first.");
        return;
      }

      const controller = new AbortController();
      abort.current = controller;
      const { signal } = controller;
      setProgress(0);
      try {
        const target = await createUploadUrl({ contentType: file.type });
        await uploadToStorage(target.uploadUrl, file, setProgress, signal);

        const created = await createVideo({
          title: values.title.trim(),
          description: values.description.trim() || undefined,
          rawFileUrl: target.fileUrl,
          visibility: values.visibility,
        });
        setVideo(created);

        /**
         * The post exists from here on, so the form must stop being a form that
         * can post it again: clearing the file and the fields is what stops a
         * second Post — and an impatient double-post — from making a duplicate
         * video out of the same clip.
         */
        setFile(null);
        setPreviewUrl(null);
        form.reset({ title: "", description: "", visibility: "PUBLIC" });

        /**
         * 201 does not mean the video is watchable: it comes back PROCESSING,
         * with no HLS URL, and stays off the feed until transcoding finishes.
         *
         * Deliberately not awaited. The post is already made; awaiting held the
         * form `submitting` — button disabled, "Posting…" — for up to five
         * minutes over work nobody has to sit through. The status arrives via
         * `setVideo`, and leaving the page aborts the poll.
         */
        void pollUntilReady(
          created.id,
          (latest) => {
            setVideo(latest);
            // Published means it is on the feed, which is where the person who
            // just posted it wants to be — and leaving this screen is what
            // stops them uploading the same clip again while they wait.
            if (latest.status === "PUBLISHED") router.push("/");
          },
          signal,
        );
      } catch (cause) {
        // An abort is the page going away, not a failure to report; anything
        // else `useForm` turns into the form-level message.
        if (signal.aborted) return;
        throw cause;
      } finally {
        setProgress(null);
      }
    },
  });

  function chooseFile(next: File | null) {
    if (!next) return;
    if (!ACCEPTED_UPLOAD_TYPES.includes(next.type as never)) {
      setFileError("That file isn’t a supported video. Use MP4, MOV or WebM.");
      return;
    }
    if (next.size > MAX_BYTES) {
      setFileError("That file is over 2 GB.");
      return;
    }

    setFileError(null);
    setVideo(null);
    setFile(next);
    setPreviewUrl(URL.createObjectURL(next));
    // Same courtesy the real Studio does: the filename is a usable first title.
    if (!form.values.title) {
      form.setValue("title", next.name.replace(/\.[^.]+$/, "").slice(0, 150));
    }
  }

  if (isLoading) {
    return (
      <Shell>
        <div className="flex w-full max-w-[610px] flex-col gap-4">
          <Skeleton className="h-8 w-40" />
          <Skeleton className="h-[420px] w-full rounded-[8px]" />
        </div>
      </Shell>
    );
  }

  if (!user) {
    return (
      <Shell>
        <p className="mb-4 text-[16px] text-[var(--tt-text)]">
          Log in to upload a video.
        </p>
        <button
          type="button"
          onClick={openLogin}
          className="h-10 rounded-[4px] bg-[var(--tt-red-active)] px-4 text-[15px] font-semibold text-white"
        >
          Log in
        </button>
      </Shell>
    );
  }

  return (
    <main className="h-screen flex-1 overflow-y-auto">
      <div className="mx-auto max-w-[1000px] px-8 py-10">
        <h1 className="mb-6 text-[24px] leading-8 font-bold text-[var(--tt-text)]">
          Upload video
        </h1>

        {!file ? (
          <DropZone accept={ACCEPT} onFile={chooseFile} error={fileError} />
        ) : (
          <div className="flex flex-col gap-8 lg:flex-row">
            <Preview
              file={file}
              url={previewUrl}
              progress={progress}
              onReplace={chooseFile}
              disabled={form.submitting}
            />

            <form
              onSubmit={form.handleSubmit}
              noValidate
              className="flex flex-1 flex-col gap-5"
            >
              <TextField
                {...form.field("title")}
                label="Title"
                maxLength={150}
                placeholder="Give it a title"
              />

              <TextField
                {...form.field("description")}
                label="Description"
                multiline
                maxLength={2000}
                placeholder="Optional"
              />

              <Labelled label="Who can watch this video">
                <select
                  value={form.values.visibility}
                  onChange={(event) =>
                    form.setValue("visibility", event.target.value as VideoVisibility)
                  }
                  className={FIELD}
                >
                  <option value="PUBLIC">Everyone</option>
                  <option value="PRIVATE">Only you</option>
                </select>
                <p className="mt-2 text-[12px] leading-[18px] text-[var(--tt-text-secondary)]">
                  Fixed once posted: there is no endpoint to change it later.
                </p>
              </Labelled>

              {form.formError && (
                <p role="alert" className="text-[14px] text-[var(--tt-red-active)]">
                  {form.formError}
                </p>
              )}

              <div className="flex gap-3">
                <button
                  type="submit"
                  disabled={form.submitting}
                  className="h-11 w-40 rounded-[4px] bg-[var(--tt-red-active)] text-[15px] font-semibold text-white disabled:bg-white/[0.08] disabled:text-white/[0.34]"
                >
                  {form.submitting ? "Posting…" : "Post"}
                </button>
                <button
                  type="button"
                  disabled={form.submitting}
                  onClick={() => {
                    setFile(null);
                    setPreviewUrl(null);
                    setVideo(null);
                  }}
                  className="h-11 w-28 rounded-[4px] bg-white/[0.12] text-[15px] font-semibold text-[var(--tt-text)] disabled:text-white/[0.34]"
                >
                  Discard
                </button>
              </div>
            </form>
          </div>
        )}

        {video && <UploadStatus video={video} />}
      </div>
    </main>
  );
}

/**
 * The click-or-drag target. `dragCounter` rather than a boolean because
 * `dragleave` fires when the pointer crosses onto a *child* of the zone, and a
 * boolean flickers the highlight off every time the cursor passes the icon.
 */
function DropZone({
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
          Up to 2 GB. Longer clips just take longer to transcode.
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

/** The chosen file, played back in a phone-shaped frame like Studio's preview. */
function Preview({
  file,
  url,
  progress,
  onReplace,
  disabled,
}: {
  file: File;
  url: string | null;
  progress: number | null;
  onReplace: (file: File | null) => void;
  disabled: boolean;
}) {
  const input = useRef<HTMLInputElement>(null);
  const percent = progress === null ? 0 : Math.round(progress * 100);

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

      {progress !== null && (
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
              className="h-full bg-[var(--tt-red-active)] transition-[width] duration-200"
              style={{ width: `${percent}%` }}
            />
          </div>
          <p className="mt-1.5 text-[13px] text-[var(--tt-text-secondary)]">
            {percent < 100 ? `Uploading… ${percent}%` : "Uploaded — posting…"}
          </p>
        </div>
      )}

      <input
        ref={input}
        type="file"
        accept={ACCEPT}
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

function formatBytes(bytes: number): string {
  const mb = bytes / (1024 * 1024);
  return mb >= 1024 ? `${(mb / 1024).toFixed(2)} GB` : `${mb.toFixed(1)} MB`;
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

function UploadStatus({ video }: { video: VideoResponse }) {
  return (
    <div className="mt-8 rounded-[8px] bg-white/[0.06] p-5">
      <p className="text-[15px] font-semibold text-[var(--tt-text)]">
        {STATUS_TEXT[video.status]}
      </p>
      <p className="mt-1 text-[13px] text-[var(--tt-text-secondary)]">
        Video id {video.id}
      </p>
      {video.status === "PUBLISHED" && (
        <Link
          href={`/video/${video.id}`}
          className="mt-3 inline-block text-[14px] font-semibold text-[var(--tt-red-active)]"
        >
          Watch it →
        </Link>
      )}
    </div>
  );
}

const STATUS_TEXT: Record<VideoResponse["status"], string> = {
  PROCESSING: "Processing — transcoding usually takes a few seconds to a few minutes.",
  PUBLISHED: "Published. It’s on the feed now.",
  FAILED: "Transcoding failed. Delete it and try uploading again.",
  TAKEN_DOWN: "This video was taken down by a moderator.",
};

const FIELD =
  "h-11 w-full rounded-[4px] border border-transparent bg-white/[0.12] px-3 text-[15px] text-[var(--tt-text)] caret-[var(--tt-red)] outline-none placeholder:text-[rgb(255_255_255/0.34)]";

/**
 * A labelled input wired to `useForm`. Spread a field onto it:
 *   `<TextField {...form.field("title")} label="Title" />`
 *
 * It is a component rather than three inline elements so the field object is
 * never held in a local variable — `ref` in it makes the React Compiler lint
 * read the whole object as a ref, and reading `.value` off one during render is
 * (rightly) an error.
 */
function TextField({
  label,
  value,
  onChange,
  error,
  ref,
  placeholder,
  maxLength,
  multiline,
}: {
  label: string;
  value: string;
  onChange: (next: string) => void;
  error?: string;
  ref?: React.Ref<HTMLInputElement & HTMLTextAreaElement>;
  placeholder?: string;
  maxLength?: number;
  multiline?: boolean;
}) {
  const className = error ? `${FIELD} border-[var(--tt-red-active)]` : FIELD;
  const shared = {
    ref,
    value,
    maxLength,
    placeholder,
    onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      onChange(event.target.value),
    "aria-invalid": error ? true : undefined,
  } as const;

  return (
    <Labelled label={label} error={error}>
      {multiline ? (
        <textarea {...shared} className={`${className} h-24 resize-none py-2`} />
      ) : (
        <input {...shared} className={className} />
      )}
    </Labelled>
  );
}

function Labelled({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-[15px] leading-[22px] font-semibold text-[var(--tt-text)]">
        {label}
      </span>
      {children}
      {error && (
        <p role="alert" className="mt-1.5 text-[13px] leading-[18px] text-[var(--tt-red-active)]">
          {error}
        </p>
      )}
    </label>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex h-screen flex-1 flex-col items-center justify-center">
      {children}
    </main>
  );
}

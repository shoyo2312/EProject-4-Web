"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { useSession } from "@/components/session/SessionProvider";
import { Skeleton } from "@/components/ui/skeleton";
import type { VideoVisibility } from "@/lib/api/types";
import {
  ACCEPTED_UPLOAD_TYPES,
  createUploadUrl,
  createVideo,
  pollUntilReady,
  uploadToStorage,
} from "@/lib/api/videos";
import { uploadSchema } from "@/lib/forms/schemas";
import { useForm } from "@/lib/forms/use-form";
import { toast } from "@/components/ui/toast";

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
  /** True from the moment the post exists until transcoding finishes. */
  const [processing, setProcessing] = useState(false);

  /**
   * The upload and the poll outlive their handler, so unmounting is what
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

        /**
         * Stay put and keep the bar on screen. The poll is awaited on purpose:
         * `submitting` stays true, so the file, the fields and Post are all
         * frozen — there is no empty upload screen to re-post from, and no
         * navigation until the video is actually watchable.
         */
        setProcessing(true);
        const latest = await pollUntilReady(created.id, undefined, signal);
        if (signal.aborted) return;

        if (latest.status === "PUBLISHED") {
          toast.success("Video posted.");
          // `?posted=1` is what turns into the "Upload complete" banner there.
          router.replace(`/video/${created.id}?posted=1`);
          return;
        }

        // FAILED, or still PROCESSING when the five-minute budget ran out.
        setProcessing(false);
        setProgress(null);
        if (latest.status === "FAILED") {
          const message = "Transcoding failed. Try uploading the file again.";
          setFormError(message);
          toast.error(message);
        } else {
          const message =
            "Still processing. It will appear on your profile when it is done.";
          setFormError(message);
          toast.warning(message);
        }
        return;
      } catch (cause) {
        // An abort is the page going away, not a failure to report; anything
        // else `useForm` turns into the form-level message.
        setProgress(null);
        setProcessing(false);
        if (signal.aborted) return;
        // `useForm` turns this into both the form-level line and an error toast.
        throw cause;
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
    setFile(next);
    setPreviewUrl(URL.createObjectURL(next));
    // Same courtesy the real Studio does: the filename is a usable first title.
    if (!form.values.title) {
      form.setValue("title", next.name.replace(/\.[^.]+$/, "").slice(0, 150));
    }
  }

  if (isLoading) return <UploadSkeleton />;

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
              processing={processing}
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
                  {processing
                    ? "Processing…"
                    : form.submitting
                      ? "Posting…"
                      : "Post"}
                </button>
                <button
                  type="button"
                  disabled={form.submitting}
                  onClick={() => {
                    setFile(null);
                    setPreviewUrl(null);
                  }}
                  className="h-11 w-28 rounded-[4px] bg-white/[0.12] text-[15px] font-semibold text-[var(--tt-text)] disabled:text-white/[0.34]"
                >
                  Discard
                </button>
              </div>
            </form>
          </div>
        )}

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
  processing,
  onReplace,
  disabled,
}: {
  file: File;
  url: string | null;
  progress: number | null;
  processing: boolean;
  onReplace: (file: File | null) => void;
  disabled: boolean;
}) {
  const input = useRef<HTMLInputElement>(null);
  /**
   * One bar for both halves of the wait. The PUT is the only part with real
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

/**
 * Placeholder for the signed-in upload page while `/me` settles.
 *
 * It reuses the page's own wrapper — `max-w-[1000px]`, `px-8 py-10`, the 24/32
 * title with `mb-6`, and the dashed drop zone with its `px-6 py-20` — so the
 * heading and the zone do not move when the real form takes over. The shell for
 * a signed-out viewer is a different (centred) layout, and it replaces this.
 */
function UploadSkeleton() {
  return (
    <main className="h-screen flex-1 overflow-y-auto">
      <div className="mx-auto max-w-[1000px] px-8 py-10">
        <Skeleton className="mb-6 h-8 w-[168px]" />

        <div className="flex flex-col items-center justify-center rounded-[8px] border-2 border-dashed border-white/20 bg-white/[0.03] px-6 py-20 text-center">
          <Skeleton className="h-12 w-12 rounded-full" />
          <Skeleton className="mt-4 h-6 w-[196px]" />
          <Skeleton className="mt-1 h-5 w-[152px]" />
          <Skeleton className="mt-6 h-11 w-[148px] rounded-[4px]" />

          <div className="mt-10 grid w-full gap-6 text-left sm:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i}>
                <Skeleton className="h-5 w-32" />
                {/* The `dd` under it runs to three short lines in the widest
                    column, which is what sets the row's 54px height. */}
                <Skeleton className="mt-1 h-[54px] w-full" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex h-screen flex-1 flex-col items-center justify-center">
      {children}
    </main>
  );
}

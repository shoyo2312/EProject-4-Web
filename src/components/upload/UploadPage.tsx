"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { useSession } from "@/components/session/SessionProvider";
import { DropZone } from "@/components/upload/page/DropZone";
import { FIELD, Labelled, TextField } from "@/components/upload/page/Fields";
import { Outcome } from "@/components/upload/page/Outcome";
import { Preview } from "@/components/upload/page/Preview";
import { UploadSkeleton } from "@/components/upload/page/UploadSkeleton";
import type { VideoStatus, VideoVisibility } from "@/lib/api/types";
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
 *   1. `POST /videos/upload-url` presigns a multipart POST into object storage;
 *   2. the browser POSTs the file straight there (progress comes from XHR);
 *   3. `POST /videos` publishes it with the `s3://` location step 1 handed back.
 *
 * Only step 3 creates anything, so a page closed mid-upload leaves an orphan
 * object the bucket's lifecycle rule expires — nothing to clean up here.
 */

/** video-service refuses anything else, and would only do so after the upload. */
const ACCEPT = ACCEPTED_UPLOAD_TYPES.join(",");
const MAX_BYTES = 500 * 1024 * 1024;
const MAX_DURATION_SECONDS = 600;

/**
 * What the uploader is told when the poll ends on anything but PUBLISHED.
 *
 * A rejection says what happened and what to do about it, without explaining
 * which frames tripped the classifier — that is a map for getting the next
 * upload past it. PENDING_REVIEW is deliberately not framed as a problem: most
 * videos that land there are fine, and the honest thing to say is that a person
 * is looking.
 */
const OUTCOME_MESSAGE: Record<VideoStatus, string> = {
  PROCESSING: "Still processing. It will appear on your profile when it is done.",
  PENDING_MODERATION:
    "Still being reviewed. It will appear on your profile when the check finishes.",
  PENDING_REVIEW:
    "This video is waiting on a moderator before it goes live. You will see it on your profile once it is approved.",
  PUBLISHED: "",
  FAILED: "Transcoding failed. Try uploading the file again.",
  REJECTED:
    "This video was removed automatically for likely adult content. If that is wrong, contact support to have it reviewed.",
  TAKEN_DOWN: "This video was taken down by a moderator.",
};

export function UploadPage() {
  const { user, isLoading, openLogin } = useSession();
  const router = useRouter();

  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  /** 0–1 while the POST runs, null otherwise — it is also what drives the bar. */
  const [progress, setProgress] = useState<number | null>(null);
  /** True from the moment the post exists until transcoding finishes. */
  const [processing, setProcessing] = useState(false);
  /** The verdict of the last post that did not end PUBLISHED; null before the first one. */
  const [outcome, setOutcome] = useState<{
    status: VideoStatus;
    message: string;
  } | null>(null);

  /**
   * The upload and the poll outlive their handler, so unmounting is what
   * stops them. The controller is made **per submit**, never up front: React
   * StrictMode mounts, unmounts and remounts in dev, so a controller created in
   * the ref initialiser is already aborted by the time anything uses it — and
   * an aborted controller cannot be reset. That was an upload stuck on
   * "Uploading… 0%" forever, because the POST was cancelled before it was sent.
   */
  const abort = useRef<AbortController | null>(null);
  useEffect(() => () => abort.current?.abort(), []);

  /**
   * The bytes are still on their way to storage. Only this stretch can be
   * cancelled or lost: once the post exists, transcoding carries on without
   * the page, so leaving then costs nothing.
   */
  const uploading = progress !== null && !processing;

  // A reload or a closed tab mid-upload throws the transfer away — ask first.
  // In-app navigation unmounts the page, which aborts the upload above.
  useEffect(() => {
    if (!uploading) return;
    const onBeforeUnload = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [uploading]);

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
    onSubmit: async (values) => {
      if (!file) {
        toast.error("Choose a video file first.");
        return;
      }

      const controller = new AbortController();
      abort.current = controller;
      const { signal } = controller;
      setProgress(0);
      try {
        const target = await createUploadUrl({ contentType: file.type });
        await uploadToStorage(target.uploadUrl, file, target.formFields, setProgress, signal);

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
          router.replace(`/video/${created.id}`);
          return;
        }

        // Anything that is not PUBLISHED: a broken transcode, a moderation
        // verdict, or still unfinished when the five-minute budget ran out.
        setProcessing(false);
        setProgress(null);

        /**
         * The post exists whatever the verdict came back as, so the file is done
         * here. Leaving it in the form makes Post a button that uploads the same
         * bytes again — and a rejected video re-posted is just a second rejected
         * video, plus another raw file in the bucket. Clearing it drops back to
         * the drop zone with the verdict above it, where the message stays put
         * instead of leaving with a toast that is gone before it is read.
         */
        setOutcome({
          status: latest.status,
          message:
            latest.status === "FAILED"
              ? (latest.failureReason ?? OUTCOME_MESSAGE.FAILED)
              : OUTCOME_MESSAGE[latest.status],
        });
        setFile(null);
        setPreviewUrl(null);
        form.reset({
          title: "",
          description: "",
          visibility: values.visibility,
        });
        return;
      } catch (cause) {
        // An abort is the page going away, not a failure to report; anything
        // else `useForm` turns into the form-level message.
        setProgress(null);
        setProcessing(false);
        if (signal.aborted) return;
        // `useForm` turns this into an error toast.
        throw cause;
      }
    },
  });

  async function chooseFile(next: File | null) {
    if (!next) return;
    if (!ACCEPTED_UPLOAD_TYPES.includes(next.type as never)) {
      setFileError("That file isn’t a supported video. Use MP4, MOV or WebM.");
      return;
    }
    if (next.size > MAX_BYTES) {
      setFileError("That file is over 500 MB.");
      return;
    }

    // A best-effort pre-check over a server backstop that already enforces this. The browser
    // cannot decode every accepted container (an HEVC .mov from an iPhone fails here but
    // transcodes fine), so a read failure must not block the upload — only a duration we
    // actually measured and that is over the limit does.
    let seconds: number | null = null;
    try {
      seconds = await readDuration(next);
    } catch {
      // undecodable in this browser ≠ undecodable server-side; let media-worker be the judge.
    }
    if (seconds !== null && seconds > MAX_DURATION_SECONDS) {
      setFileError("That video is longer than 10 minutes.");
      return;
    }

    setFileError(null);
    setOutcome(null);
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

        {outcome && !file ? (
          <Outcome status={outcome.status} message={outcome.message} />
        ) : null}

        {!file ? (
          <DropZone accept={ACCEPT} onFile={chooseFile} error={fileError} />
        ) : (
          <div className="flex flex-col gap-8 lg:flex-row">
            <Preview
              accept={ACCEPT}
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
                  <option value="FRIENDS">Friends</option>
                  <option value="PRIVATE">Only you</option>
                </select>
              </Labelled>

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
                  disabled={form.submitting && !uploading}
                  onClick={() => {
                    // Mid-upload this stops the transfer and keeps the file and
                    // fields, so Post retries it; otherwise it drops the file.
                    if (uploading) {
                      abort.current?.abort();
                      toast.success("Upload canceled.");
                      return;
                    }
                    setFile(null);
                    setPreviewUrl(null);
                  }}
                  className="h-11 w-28 rounded-[4px] bg-white/[0.12] text-[15px] font-semibold text-[var(--tt-text)] disabled:text-white/[0.34]"
                >
                  {uploading ? "Cancel" : "Discard"}
                </button>
              </div>
            </form>
          </div>
        )}

      </div>
    </main>
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

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex h-screen flex-1 flex-col items-center justify-center">
      {children}
    </main>
  );
}

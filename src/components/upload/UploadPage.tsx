"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { useSession } from "@/components/session/SessionProvider";
import { isApiError } from "@/lib/api/errors";
import type { VideoResponse, VideoVisibility } from "@/lib/api/types";
import { createVideo, pollUntilReady } from "@/lib/api/videos";
import { uploadSchema } from "@/lib/forms/schemas";
import { useForm } from "@/lib/forms/use-form";

/**
 * `/upload` — posts a video to video-service.
 *
 * The file itself is NOT uploaded here, and cannot be: object storage is
 * media-worker's territory and no upload endpoint is exposed yet. What
 * video-service takes is a `rawFileUrl` that already points at stored media,
 * which it hands to media-worker to fetch and transcode. It is allow-listed on
 * purpose — `https` on a configured CDN host, or `s3://` on a configured
 * bucket — because an arbitrary URL would turn the backend into a fetch proxy
 * for whoever posts one.
 *
 * So this screen takes the URL directly. When an upload service lands, only the
 * field changes; the create-then-poll flow below stays as it is.
 */
export function UploadPage() {
  const { user, isLoading, openLogin } = useSession();

  const [video, setVideo] = useState<VideoResponse | null>(null);

  // The poll outlives the submit, so unmounting is what stops it.
  const pollAbort = useRef(new AbortController());
  useEffect(() => {
    const controller = pollAbort.current;
    return () => controller.abort();
  }, []);

  const form = useForm({
    schema: uploadSchema,
    initialValues: {
      title: "",
      description: "",
      rawFileUrl: "",
      visibility: "PUBLIC" as VideoVisibility,
    },
    onSubmit: async (values, { setFieldError }) => {
      let created: VideoResponse;
      try {
        created = await createVideo({
          title: values.title.trim(),
          description: values.description.trim() || undefined,
          rawFileUrl: values.rawFileUrl.trim(),
          visibility: values.visibility,
        });
      } catch (cause) {
        /**
         * The host allow-list lives in the deployment's config, so the client
         * can only check the scheme. When the server rejects the URL itself,
         * the message belongs on the URL field rather than under the button.
         */
        if (isApiError(cause) && cause.is("VALIDATION_ERROR")) {
          setFieldError(
            "rawFileUrl",
            "The server rejected this URL. It must be on an allowed CDN host or bucket.",
          );
          return;
        }
        throw cause;
      }

      setVideo(created);

      /**
       * 201 does not mean the video is watchable: it comes back PROCESSING,
       * with no HLS URL, and stays off the feed until transcoding finishes.
       * The poll backs off (2s → 5s → 10s) and gives up after five minutes,
       * because the gateway's 20 req/s IP budget is shared with everything
       * else the app is doing.
       *
       * Deliberately not awaited. The post is already made; awaiting held the
       * form `submitting` — button disabled, "Posting…" — for up to those five
       * minutes over work nobody has to sit through. The status arrives via
       * `setVideo`, and leaving the page aborts the poll.
       */
      void pollUntilReady(created.id, setVideo, pollAbort.current.signal);
    },
  });

  if (isLoading) return <Shell>Loading…</Shell>;

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
      <div className="mx-auto max-w-[720px] px-8 py-10">
        <h1 className="mb-2 text-[24px] leading-8 font-bold text-[var(--tt-text)]">
          Upload video
        </h1>
        <p className="mb-8 text-[14px] leading-5 text-[var(--tt-text-secondary)]">
          Paste the storage URL of media that has already been uploaded. The
          server accepts <code>https://</code> on an allowed CDN host or{" "}
          <code>s3://bucket/key</code> on an allowed bucket, and rejects
          everything else.
        </p>

        <form onSubmit={form.handleSubmit} noValidate className="flex flex-col gap-5">
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

          <TextField
            {...form.field("rawFileUrl")}
            label="Media URL"
            maxLength={500}
            placeholder="s3://video-media/raw/example.mp4"
          />

          <Labelled label="Visibility">
            <select
              value={form.values.visibility}
              onChange={(event) =>
                form.setValue("visibility", event.target.value as VideoVisibility)
              }
              className={FIELD}
            >
              <option value="PUBLIC">Public</option>
              <option value="PRIVATE">Private — only you can watch it</option>
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

          <button
            type="submit"
            disabled={form.submitting}
            className="h-11 w-40 rounded-[4px] bg-[var(--tt-red-active)] text-[15px] font-semibold text-white disabled:bg-white/[0.08] disabled:text-white/[0.34]"
          >
            {form.submitting ? "Posting…" : "Post"}
          </button>
        </form>

        {video && <UploadStatus video={video} />}
      </div>
    </main>
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

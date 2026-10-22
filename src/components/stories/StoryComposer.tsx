"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { Modal } from "@/components/ui/modal";
import { FIELD } from "@/components/upload/page/Fields";
import { isApiError, messageFor } from "@/lib/api/errors";
import { createStory, createStoryUploadUrl } from "@/lib/api/stories";
import type { StoryResponse, StoryVisibility } from "@/lib/api/types";
import { uploadToStorage } from "@/lib/api/videos";
import { STORY_UPLOAD_TYPES, storyDurationProblem, storyFileProblem } from "@/lib/stories/upload-rules";

import { useStories } from "./StoriesProvider";

const CAPTION_MAX = 300;

/**
 * Posting a story: pick a photo or a short video, add a caption and an audience, post. The same
 * three steps as a video — presign, upload straight to storage, create — and the story then waits
 * for moderation, which the viewer's own bubble shows as "Pending review".
 */
export function StoryComposer({
  onClose,
  onPosted,
}: {
  onClose: () => void;
  onPosted: (story: StoryResponse) => void;
}) {
  const { invalidateOwnRing } = useStories();
  const [file, setFile] = useState<File | null>(null);
  const [caption, setCaption] = useState("");
  const [visibility, setVisibility] = useState<StoryVisibility>("PUBLIC");
  const [progress, setProgress] = useState<number | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [captionError, setCaptionError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // A video is only postable once its length has been read from the preview.
  const [checked, setChecked] = useState(false);
  // A refused caption saves nothing, so the same upload can back the next attempt.
  const uploaded = useRef<{ file: File; fileUrl: string } | null>(null);

  const preview = useMemo(() => (file ? URL.createObjectURL(file) : null), [file]);
  useEffect(() => () => {
    if (preview) URL.revokeObjectURL(preview);
  }, [preview]);

  const posting = progress !== null;

  function choose(picked: File | undefined) {
    setError(null);
    if (!picked) return;
    const problem = storyFileProblem(picked);
    setFileError(problem);
    setFile(problem ? null : picked);
    setChecked(picked.type.startsWith("image/"));
  }

  function refuse(problem: string) {
    setFileError(problem);
    setFile(null);
  }

  function measured(seconds: number) {
    // A recording with no length in its header (a browser-recorded WebM) reads as Infinity here,
    // and media-worker cannot probe it either: posted, it would only ever be held.
    const problem = Number.isFinite(seconds)
      ? storyDurationProblem(seconds)
      : "This video’s length can’t be read. Choose another file.";
    if (problem) refuse(problem);
    else setChecked(true);
  }

  async function post() {
    if (!file || !checked || posting) return;
    setError(null);
    setCaptionError(null);
    setProgress(0);
    try {
      let fileUrl = uploaded.current?.file === file ? uploaded.current.fileUrl : null;
      if (!fileUrl) {
        const upload = await createStoryUploadUrl(file.type);
        await uploadToStorage(upload.uploadUrl, file, upload.formFields, setProgress);
        uploaded.current = { file, fileUrl: upload.fileUrl };
        fileUrl = upload.fileUrl;
      }
      const story = await createStory({
        mediaUrl: fileUrl,
        caption: caption.trim() || null,
        visibility,
      });
      invalidateOwnRing();
      onPosted(story);
    } catch (caught) {
      if (isApiError(caught) && caught.is("STORY_CAPTION_REJECTED")) {
        setCaptionError(messageFor(caught));
      } else {
        setError(messageFor(caught, "Couldn’t post your story. Try again."));
      }
      setProgress(null);
    }
  }

  return (
    <Modal onClose={posting ? () => {} : onClose} className="w-[420px] rounded-[12px] p-6">
      <h2 className="mb-4 text-[20px] leading-7 font-bold text-[var(--tt-text)]">Create a story</h2>

      <label className="relative flex aspect-[9/16] max-h-[52vh] w-full cursor-pointer items-center justify-center overflow-hidden rounded-[8px] bg-white/[0.06]">
        {preview && file?.type.startsWith("image/") && (
          // eslint-disable-next-line @next/next/no-img-element -- a local blob preview
          <img src={preview} alt="" className="h-full w-full object-contain" />
        )}
        {preview && file?.type.startsWith("video/") && (
          <video
            src={preview}
            muted
            autoPlay
            loop
            playsInline
            onLoadedMetadata={(event) => measured(event.currentTarget.duration)}
            // Stories play the upload as it is, never transcoded: what this browser cannot play
            // would be a broken story for everyone else too.
            onError={() => refuse("This video can’t be played here. Choose an MP4 or WebM video.")}
            className="h-full w-full object-contain"
          />
        )}
        {!preview && (
          <span className="px-6 text-center text-[15px] text-[var(--tt-text-secondary)]">
            Choose a photo or a video up to 60 seconds
          </span>
        )}
        <input
          type="file"
          accept={STORY_UPLOAD_TYPES.join(",")}
          disabled={posting}
          onChange={(event) => {
            choose(event.target.files?.[0]);
            // Choosing the same file again after it was refused still has to fire `change`.
            event.target.value = "";
          }}
          className="absolute inset-0 cursor-pointer opacity-0"
        />
      </label>
      {fileError && <p className="mt-2 text-[13px] text-[var(--tt-red)]">{fileError}</p>}

      <textarea
        value={caption}
        onChange={(event) => {
          setCaption(event.target.value);
          setCaptionError(null);
        }}
        maxLength={CAPTION_MAX}
        disabled={posting}
        placeholder="Add a caption (optional)"
        rows={2}
        className={`${FIELD} mt-4 h-auto resize-none py-2`}
      />
      <div className="mt-1 flex justify-between text-[12px] text-[var(--tt-text-muted)]">
        <span className="text-[var(--tt-red)]">{captionError}</span>
        <span>
          {caption.length}/{CAPTION_MAX}
        </span>
      </div>

      <label className="mt-3 block text-[14px] font-semibold text-[var(--tt-text)]">
        Who can see this story
        <select
          value={visibility}
          disabled={posting}
          onChange={(event) => setVisibility(event.target.value as StoryVisibility)}
          className={`${FIELD} mt-2`}
        >
          <option value="PUBLIC">Everyone</option>
          <option value="FRIENDS">Friends</option>
          <option value="PRIVATE">Only you</option>
        </select>
      </label>

      {posting && (
        <progress
          max={1}
          value={progress}
          className="mt-4 h-1 w-full appearance-none overflow-hidden rounded-full [&::-moz-progress-bar]:bg-[var(--tt-red)] [&::-webkit-progress-bar]:bg-white/10 [&::-webkit-progress-value]:bg-[var(--tt-red)]"
        />
      )}
      {error && <p className="mt-3 text-[13px] text-[var(--tt-red)]">{error}</p>}

      <div className="mt-5 flex justify-end gap-3">
        <button
          type="button"
          onClick={onClose}
          disabled={posting}
          className="h-10 rounded-[4px] bg-white/[0.08] px-5 text-[15px] font-semibold text-[var(--tt-text)] disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={post}
          disabled={!file || !checked || posting}
          className="h-10 rounded-[4px] bg-[var(--tt-red)] px-5 text-[15px] font-semibold text-white hover:bg-[var(--tt-red-hover)] disabled:opacity-50"
        >
          {posting ? "Posting…" : "Post"}
        </button>
      </div>
    </Modal>
  );
}

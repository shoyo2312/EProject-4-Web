"use client";

import { AtSign, Check, ChevronDown, Hash } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useId, useRef, useState } from "react";

import { useSession } from "@/components/session/SessionProvider";
import { PostPreview } from "@/components/studio/edit/PostPreview";
import { StatusNote } from "@/components/studio/PostCell";
import {
  Checkbox,
  EmptyState,
  Popover,
  StudioCard,
  StudioSkeleton,
} from "@/components/studio/ui";
import { toast } from "@/components/ui/toast";
import { useStudioQuery } from "@/hooks/use-studio-query";
import { messageFor } from "@/lib/api/errors";
import type { VideoResponse, VideoVisibility } from "@/lib/api/types";
import {
  getVideo,
  updateVideoCaption,
  updateVideoCommentsSetting,
  updateVideoVisibility,
} from "@/lib/api/videos";
import { PRIVACY_LABEL, VISIBILITIES } from "@/lib/studio/overview";
import { insertToken } from "@/lib/studio/posts";
import { cn } from "@/lib/utils";

// video-service's limits, counted the way it counts them: in code points, not UTF-16 units.
const TITLE_MAX = 150;
const DESCRIPTION_MAX = 2000;
const length = (text: string) => [...text].length;

/** TikTok Studio's "Who can watch this video" menu: the Posts table's names, Friends with its explainer. */
const PRIVACY_HINT: Partial<Record<VideoVisibility, string>> = {
  FRIENDS: "Followers you follow back",
};
const PRIVACY_OPTIONS = VISIBILITIES.map((value) => ({
  value,
  label: PRIVACY_LABEL[value],
  hint: PRIVACY_HINT[value],
}));

/**
 * `/studio/content/{id}/edit` — TikTok Studio's edit page: Details (title,
 * description with # and @ helpers, cover), Settings (who can watch, comments),
 * Save / Cancel, and the Feed / Profile / Web preview beside it. Location, cover
 * editing, reuse of content and content disclosure have no backend here.
 */
export function StudioEditPost({ videoId }: { videoId: string }) {
  const video = useStudioQuery(`video:${videoId}`, (signal) =>
    getVideo(videoId, signal),
  );
  if (video.error) return <EmptyState>{video.error}</EmptyState>;
  if (!video.data) return <EditSkeleton />;
  // Nothing to edit on a post that never transcoded: say so, and point back to Posts, where Delete is.
  if (video.data.status === "FAILED")
    return (
      <div className="flex flex-col items-start gap-4">
        <StatusNote status="FAILED" />
        <Link
          href="/studio/content"
          className="text-[14px] font-semibold text-[#fe2c55] hover:underline"
        >
          Back to posts
        </Link>
      </div>
    );
  // Keyed on the video: the query keeps the previous answer while the next loads, and the
  // form seeds its state once, so without this the next video would open with the last one's text.
  return <EditForm key={video.data.id} video={video.data} />;
}

/** The edit page's shape while the video loads: measured off the rendered form, 990px form + 260px preview. */
function EditSkeleton() {
  return (
    <div className="flex gap-6" role="status" aria-label="Loading">
      <div className="flex min-w-0 flex-1 flex-col gap-8">
        <StudioSkeleton className="h-11 rounded-[8px]" />
        <section className="flex flex-col gap-4">
          <StudioSkeleton className="h-[21px] w-16" />
          <StudioSkeleton className="h-[529px] rounded-[8px]" />
        </section>
        <section className="flex flex-col gap-4">
          <StudioSkeleton className="h-[21px] w-16" />
          <StudioSkeleton className="h-[178px] rounded-[8px]" />
        </section>
        <div className="flex gap-2">
          <StudioSkeleton className="h-9 w-[200px] rounded-[8px]" />
          <StudioSkeleton className="h-9 w-[70px] rounded-[8px]" />
        </div>
      </div>
      <aside className="hidden w-[260px] flex-none lg:block">
        <div className="sticky top-6 flex flex-col gap-3">
          <StudioSkeleton className="h-9 rounded-[8px]" />
          <StudioSkeleton className="h-[560px] rounded-[16px]" />
        </div>
      </aside>
    </div>
  );
}

function EditForm({ video }: { video: VideoResponse }) {
  const router = useRouter();
  const { user } = useSession();
  const descriptionRef = useRef<HTMLTextAreaElement>(null);
  const [title, setTitle] = useState(video.title);
  const [description, setDescription] = useState(video.description ?? "");
  const [visibility, setVisibility] = useState<VideoVisibility>(
    video.visibility,
  );
  const [allowComments, setAllowComments] = useState(!video.commentsDisabled);
  const [saving, setSaving] = useState(false);

  const captionChanged =
    title.trim() !== video.title ||
    description.trim() !== (video.description ?? "");
  const changed =
    captionChanged ||
    visibility !== video.visibility ||
    allowComments === video.commentsDisabled;
  const valid =
    title.trim() !== "" &&
    length(title) <= TITLE_MAX &&
    length(description) <= DESCRIPTION_MAX;

  const insert = (token: string) => {
    const box = descriptionRef.current;
    if (!box) return;
    const next = insertToken(
      description,
      box.selectionStart,
      box.selectionEnd,
      token,
    );
    setDescription(next.text);
    requestAnimationFrame(() => {
      box.focus();
      box.setSelectionRange(next.caret, next.caret);
    });
  };

  // One call per part that changed, caption first: it is the one the text screen can refuse,
  // and nothing else should land when it does.
  const save = async () => {
    setSaving(true);
    try {
      if (captionChanged) {
        await updateVideoCaption(video.id, {
          title: title.trim(),
          description: description.trim() || undefined,
        });
      }
      if (visibility !== video.visibility)
        await updateVideoVisibility(video.id, visibility);
      if (allowComments === video.commentsDisabled)
        await updateVideoCommentsSetting(video.id, !allowComments);
      toast.success("Changes saved");
      router.push("/studio/content");
    } catch (cause) {
      toast.error(messageFor(cause));
      setSaving(false);
    }
  };

  return (
    <div className="flex gap-6">
      <div className="flex min-w-0 flex-1 flex-col gap-8">
        <StatusNote status={video.status} />
        <Section title="Details">
          <Labelled label="Title">
            {(id) => (
              <div className="flex h-11 items-center gap-3 rounded-[8px] bg-black/5 px-3 focus-within:ring-1 focus-within:ring-black/20">
                <input
                  id={id}
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  className="min-w-0 flex-1 bg-transparent text-[16px] outline-none"
                />
                <Counter count={length(title)} max={TITLE_MAX} />
              </div>
            )}
          </Labelled>

          <Labelled label="Description">
            {(id) => (
              <div className="rounded-[8px] bg-black/5 px-3 pt-3 pb-2.5 focus-within:ring-1 focus-within:ring-black/20">
                <textarea
                  id={id}
                  ref={descriptionRef}
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  rows={4}
                  placeholder="Share more about your video here…"
                  className="block w-full resize-none bg-transparent text-[16px] leading-[21px] outline-none placeholder:text-black/34"
                />
                <div className="flex items-center justify-between pt-3">
                  <div className="flex items-center gap-3">
                    <CaptionHelper
                      icon={Hash}
                      label="Hashtags"
                      onClick={() => insert("#")}
                    />
                    <CaptionHelper
                      icon={AtSign}
                      label="Mention"
                      onClick={() => insert("@")}
                    />
                  </div>
                  <Counter count={length(description)} max={DESCRIPTION_MAX} />
                </div>
              </div>
            )}
          </Labelled>

          <div className="flex flex-col gap-2">
            <span className="text-[14px] leading-5 font-medium">Cover</span>
            <div className="h-[176px] w-[132px] overflow-hidden rounded-[8px] bg-black/5">
              {video.thumbnailUrl && (
                // eslint-disable-next-line @next/next/no-img-element -- a signed MinIO URL, any host
                <img
                  src={video.thumbnailUrl}
                  alt=""
                  className="h-full w-full object-cover"
                />
              )}
            </div>
          </div>
        </Section>

        <Section title="Settings">
          <div className="flex flex-col gap-2">
            <span className="text-[14px] leading-5 font-medium">
              Who can watch this video
            </span>
            <PrivacySelect value={visibility} onChange={setVisibility} />
          </div>
          <div className="flex flex-col gap-2">
            <span className="text-[14px] leading-5 font-medium">
              Allow users to:
            </span>
            <label className="flex w-fit cursor-pointer items-center gap-2 text-[14px]">
              <Checkbox
                checked={allowComments}
                onChange={() => setAllowComments((value) => !value)}
              />
              Comment
            </label>
          </div>
        </Section>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={save}
            disabled={!changed || !valid || saving}
            className="h-9 w-[200px] rounded-[8px] bg-[#fe2c55] px-3 text-[14px] font-medium text-white transition-colors hover:bg-[#ea284e] disabled:cursor-not-allowed disabled:bg-[#fe2c55]/40"
          >
            {saving ? "Saving…" : "Save"}
          </button>
          <Link
            href="/studio/content"
            className="flex h-9 items-center rounded-[8px] bg-black/5 px-3 text-[14px] font-medium transition-colors hover:bg-black/8"
          >
            Cancel
          </Link>
        </div>
      </div>

      <PostPreview
        video={video}
        caption={[title.trim(), description.trim()].filter(Boolean).join(" ")}
        username={user?.username ?? ""}
        avatarUrl={user?.avatarUrl}
      />
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-[16px] leading-[21px] font-bold">{title}</h2>
      <StudioCard className="flex flex-col gap-6 p-5">{children}</StudioCard>
    </section>
  );
}

function Labelled({
  label,
  children,
}: {
  label: string;
  children: (id: string) => React.ReactNode;
}) {
  const id = useId();
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="w-fit text-[14px] leading-5 font-medium">
        {label}
      </label>
      {children(id)}
    </div>
  );
}

/** TikTok's "n/limit" in the box's corner, red once over. */
function Counter({ count, max }: { count: number; max: number }) {
  return (
    <span
      className={cn(
        "flex-none text-[14px] leading-[18px]",
        count > max ? "text-[#fe2c55]" : "text-black/34",
      )}
    >
      {count}/{max}
    </span>
  );
}

function CaptionHelper({
  icon: Icon,
  label,
  onClick,
}: {
  icon: typeof Hash;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-1 text-[14px] leading-[18px] font-medium text-black/65 transition-colors hover:text-black"
    >
      <Icon className="h-3.5 w-3.5" strokeWidth={2.5} />
      {label}
    </button>
  );
}

/** A 280px grey select whose menu ticks the choice; Friends carries TikTok's explainer line. */
function PrivacySelect({
  value,
  onChange,
}: {
  value: VideoVisibility;
  onChange: (value: VideoVisibility) => void;
}) {
  const current = PRIVACY_OPTIONS.find((option) => option.value === value);
  return (
    <Popover
      className="top-[calc(100%+4px)] w-[280px]"
      trigger={({ open, toggle }) => (
        <button
          type="button"
          onClick={toggle}
          aria-haspopup="listbox"
          aria-expanded={open}
          className={cn(
            "flex h-9 w-[280px] items-center justify-between rounded-[8px] bg-black/5 px-3 text-[14px] transition-shadow",
            open && "ring-1 ring-black",
          )}
        >
          {current?.label}
          <ChevronDown
            className={cn(
              "h-4 w-4 transition-transform duration-200",
              open && "rotate-180",
            )}
          />
        </button>
      )}
    >
      {(close) => (
        <div role="listbox">
          {PRIVACY_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              role="option"
              aria-selected={option.value === value}
              onClick={() => {
                onChange(option.value);
                close();
              }}
              className="flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left transition-colors hover:bg-black/4"
            >
              <span className="flex flex-col">
                <span
                  className={cn(
                    "text-[14px] leading-5",
                    option.value === value && "font-semibold",
                  )}
                >
                  {option.label}
                </span>
                {option.hint && (
                  <span className="text-[12px] leading-4 text-black/48">
                    {option.hint}
                  </span>
                )}
              </span>
              {option.value === value && (
                <Check className="h-4 w-4 flex-none" />
              )}
            </button>
          ))}
        </div>
      )}
    </Popover>
  );
}

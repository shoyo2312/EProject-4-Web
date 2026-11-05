"use client";

import { ImageOff, Play, RotateCw } from "lucide-react";
import { useState } from "react";

import { useChatUnreadContext } from "@/components/messages/ChatUnreadProvider";
import { useStories } from "@/components/stories/StoriesProvider";
import { toast } from "@/components/ui/toast";
import { unknownAuthor } from "@/lib/api/adapters";
import type { StoryCard } from "@/lib/api/conversations";
import { cn } from "@/lib/utils";

/**
 * A reply to a story, as the history draws it: a line saying whose story it answers, the story as a
 * small portrait card and, under it, the reply text in an ordinary bubble. The card is read by the
 * server for this viewer on every load — a story that expired, was deleted or is no longer theirs to
 * watch is a short notice and the text stays. Nothing plays here: a video shows its first frame.
 */
export function StoryReplyMessage({
  story,
  mine,
  text,
  bubbleClassName,
}: {
  story: StoryCard | null | undefined;
  mine: boolean;
  text: string | null;
  bubbleClassName: string;
}) {
  return (
    <div className={cn("flex flex-col gap-1", mine ? "items-end" : "items-start")}>
      <span className="px-1 text-[12.5px] leading-4 text-[var(--chat-meta)]">
        {mine ? "You replied to their story" : "Replied to your story"}
      </span>
      <StoryPreview story={story} />
      {text && <div className={bubbleClassName}>{text}</div>}
    </div>
  );
}

function StoryPreview({ story }: { story: StoryCard | null | undefined }) {
  const { openStories } = useStories();
  const { authors } = useChatUnreadContext();
  const [failed, setFailed] = useState<string | null>(null);

  if (!story || story.state !== "AVAILABLE" || !story.mediaUrl) {
    const unknown = story?.state === "UNKNOWN";
    return (
      <div
        role="img"
        aria-label={unknown ? "Story couldn't be loaded" : "Story unavailable"}
        className="flex h-[72px] w-[220px] max-w-full flex-none items-center gap-3 rounded-[var(--chat-radius-bubble)] border border-[var(--chat-line)] bg-[var(--chat-raised)] px-4"
      >
        <span className="flex h-10 w-10 flex-none items-center justify-center rounded-full bg-white/[0.07] text-[var(--chat-meta)]">
          {unknown ? <RotateCw aria-hidden className="h-[18px] w-[18px]" /> : <ImageOff aria-hidden className="h-[18px] w-[18px]" />}
        </span>
        <span className="min-w-0 text-[13.5px] leading-[18px] font-semibold text-[var(--tt-text)]">
          {unknown ? "Couldn't load this story right now" : "Story isn't available"}
        </span>
      </div>
    );
  }

  const broken = failed === story.mediaUrl;
  const open = async () => {
    const owner = story.ownerId ?? "";
    if (!(await openStories(authors.get(owner) ?? unknownAuthor(owner)))) {
      toast.error("This story isn't available anymore");
    }
  };

  return (
    <button
      type="button"
      onClick={() => void open()}
      aria-label="Open story"
      className="group/story relative block h-[240px] w-[135px] flex-none overflow-hidden rounded-[var(--chat-radius-bubble)] bg-[var(--chat-raised)] ring-1 ring-white/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
    >
      {broken ? (
        <span aria-hidden className="flex h-full w-full items-center justify-center text-[var(--chat-meta)]">
          <ImageOff className="h-6 w-6" />
        </span>
      ) : story.mediaType === "VIDEO" ? (
        // Metadata only, muted, never autoplay: the first frame is the preview; sound plays in the viewer.
        <video
          src={`${story.mediaUrl}#t=0.1`}
          preload="metadata"
          muted
          playsInline
          tabIndex={-1}
          aria-hidden
          onError={() => setFailed(story.mediaUrl)}
          className="pointer-events-none h-full w-full object-cover"
        />
      ) : (
        // eslint-disable-next-line @next/next/no-img-element -- a presigned URL that expires; next/image would cache it
        <img
          src={story.mediaUrl ?? undefined}
          alt=""
          decoding="async"
          loading="lazy"
          onError={() => setFailed(story.mediaUrl)}
          className="h-full w-full object-cover transition-transform duration-300 group-hover/story:scale-[1.03] motion-reduce:transition-none motion-reduce:group-hover/story:scale-100"
        />
      )}
      {story.mediaType === "VIDEO" && !broken && (
        <span aria-hidden className="absolute inset-0 flex items-center justify-center">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-black/45 text-white ring-1 ring-white/25">
            <Play className="ml-0.5 h-4 w-4 fill-white" />
          </span>
        </span>
      )}
    </button>
  );
}

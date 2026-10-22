import { cn } from "@/lib/utils";

export type StoryRingState = "unseen" | "seen" | "none";

/**
 * The ring around an avatar that has live stories: TikTok red while any is unseen, grey after.
 * `thin` draws it 1px with a 1px gap, for small avatars; `fill` makes it fill the box the caller
 * sized, instead of growing around the picture.
 */
export function StoryRing({
  state,
  className,
  thin = false,
  fill = false,
  children,
}: {
  state: StoryRingState;
  className?: string;
  thin?: boolean;
  fill?: boolean;
  children: React.ReactNode;
}) {
  const padding = thin ? "p-[1px]" : "p-[2px]";
  return (
    <span
      className={cn(
        "inline-flex shrink-0 rounded-full",
        padding,
        // Block-level: an inline box sits on the text baseline, which leaves a gap under it.
        fill && "flex h-full w-full",
        state === "unseen" && "bg-[var(--tt-red)]",
        state === "seen" && "bg-white/30",
        className,
      )}
    >
      <span className={cn("inline-flex rounded-full bg-[var(--tt-page)]", padding, fill && "h-full w-full")}>
        {children}
      </span>
    </span>
  );
}

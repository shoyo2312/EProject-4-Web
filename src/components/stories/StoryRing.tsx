import { cn } from "@/lib/utils";

export type StoryRingState = "unseen" | "seen" | "none";

/** The ring around an avatar that has live stories: TikTok red while any is unseen, grey after. */
export function StoryRing({
  state,
  className,
  children,
}: {
  state: StoryRingState;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 rounded-full p-[2px]",
        state === "unseen" && "bg-[var(--tt-red)]",
        state === "seen" && "bg-white/30",
        className,
      )}
    >
      <span className="inline-flex rounded-full bg-[var(--tt-page)] p-[2px]">{children}</span>
    </span>
  );
}

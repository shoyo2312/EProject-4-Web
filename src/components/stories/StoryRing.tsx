import { cn } from "@/lib/utils";

export type StoryRingState = "unseen" | "seen" | "none";

/**
 * The ring around an avatar that has live stories: a red gradient while any is unseen, grey after,
 * fading from one to the other instead of snapping. `thin` draws it 1px with a 1px gap, for small
 * avatars; `fill` makes it fill the box the caller sized, instead of growing around the picture.
 *
 * Motion, all of it `motion-safe`: with `spin`, an unseen ring turns slowly — asked for only by the
 * tray bubbles and the profile header, never by the lists, which keep dozens of rings mounted all
 * session; `pending` adds a turning dashed stroke while the owner's story waits for its verdict;
 * `pop` plays one scale-and-glow, for the bubble a story was just posted from.
 */
export function StoryRing({
  state,
  className,
  thin = false,
  fill = false,
  spin = false,
  pending = false,
  pop = false,
  children,
}: {
  state: StoryRingState;
  className?: string;
  thin?: boolean;
  fill?: boolean;
  spin?: boolean;
  pending?: boolean;
  pop?: boolean;
  children: React.ReactNode;
}) {
  const padding = thin ? "p-[1px]" : "p-[2px]";
  return (
    <span
      data-ring={state}
      data-pending={pending || undefined}
      data-pop={pop || undefined}
      className={cn(
        "relative inline-flex shrink-0 rounded-full",
        padding,
        // Block-level: an inline box sits on the text baseline, which leaves a gap under it.
        fill && "flex h-full w-full",
        pop && "motion-safe:animate-[tt-ring-pop_500ms_ease-out]",
        className,
      )}
    >
      <span
        aria-hidden
        className={cn(
          "absolute inset-0 rounded-full bg-white/30 transition-opacity duration-400",
          state === "none" && "opacity-0",
        )}
      />
      <span
        aria-hidden
        className={cn(
          "absolute inset-0 rounded-full bg-[conic-gradient(var(--tt-red),#ff2d55,#ff7a45,var(--tt-red))] transition-opacity duration-400",
          state === "unseen" ? "opacity-100" : "opacity-0",
          state === "unseen" && spin && "tt-ring-spin",
        )}
      />
      {pending && (
        <span
          aria-hidden
          className="absolute inset-0 rounded-full border border-dashed border-white/40 motion-safe:animate-[tt-ring-spin_2s_linear_infinite]"
        />
      )}
      <span className={cn("relative inline-flex rounded-full bg-[var(--tt-page)]", padding, fill && "h-full w-full")}>
        {children}
      </span>
    </span>
  );
}

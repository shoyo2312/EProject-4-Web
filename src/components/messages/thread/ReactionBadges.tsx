"use client";

import { useState } from "react";

import type { ReactionView } from "@/lib/api/conversations";
import { groupReactions, reactionMotion, type ReactionGroup, type ReactionMotion } from "@/lib/chat";
import { cn } from "@/lib/utils";

/**
 * The reactions under a message, one pill per emoji. Pressing the viewer's own takes it back.
 *
 * Only the pill that changed moves: a new emoji pops in, a higher count gives that pill a small bump.
 * What is already there when this mounts (history, an older page) and what stays the same across an
 * update does not animate.
 */
export function ReactionBadges({
  reactions,
  me,
  mine,
  onToggle,
}: {
  reactions: readonly ReactionView[];
  me: string;
  /** The message is the viewer's: the pills sit under its right edge. */
  mine: boolean;
  onToggle: (emoji: string) => void;
}) {
  const groups = groupReactions(reactions, me);
  const key = groups.map((group) => `${group.emoji}:${group.count}`).join("|");
  const [seen, setSeen] = useState<{ key: string; counts: ReadonlyMap<string, number>; motion: ReadonlyMap<string, ReactionMotion> }>(
    () => ({ key, counts: countsOf(groups), motion: new Map() }),
  );
  // Derived while rendering: what changed since the last distinct set of badges. It stays put across
  // unrelated renders, so the classes do not change and nothing replays.
  if (seen.key !== key) setSeen({ key, counts: countsOf(groups), motion: reactionMotion(seen.counts, groups) });
  const motion = seen.motion;

  if (reactions.length === 0) return null;

  return (
    <div className={cn("relative z-[2] -mt-2 flex flex-wrap gap-1 px-3", mine ? "justify-end" : "justify-start")}>
      {groups.map((group) => (
        <button
          key={group.emoji}
          type="button"
          onClick={() => onToggle(group.emoji)}
          aria-label={`${group.emoji} ${group.count}${group.mine ? ", yours — press to remove" : ""}`}
          aria-pressed={group.mine}
          data-motion={motion.get(group.emoji)}
          className={cn(
            "flex h-6 items-center gap-1 rounded-full border bg-[var(--chat-raised)] px-2 text-[13px] leading-none shadow-[0_0_0_2px_var(--chat-thread)] transition-colors",
            "focus-visible:outline-2 focus-visible:outline-white/70",
            motion.get(group.emoji) === "pop" && "motion-safe:animate-chat-react-pop",
            motion.get(group.emoji) === "bump" && "motion-safe:animate-chat-react-bump",
            group.mine
              ? "border-[var(--chat-own)]/60 bg-[var(--chat-own)]/15"
              : "border-[var(--chat-line-strong)] hover:bg-[var(--chat-active)]",
          )}
        >
          <span>{group.emoji}</span>
          {group.count > 1 && <span className="text-[11.5px] font-medium text-[var(--chat-meta)]">{group.count}</span>}
        </button>
      ))}
    </div>
  );
}

function countsOf(groups: readonly ReactionGroup[]): ReadonlyMap<string, number> {
  return new Map(groups.map((group) => [group.emoji, group.count]));
}

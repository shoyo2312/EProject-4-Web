"use client";

import type { ReactionView } from "@/lib/api/conversations";
import { groupReactions } from "@/lib/chat";
import { cn } from "@/lib/utils";

/** The reactions under a message, one pill per emoji. Pressing the viewer's own takes it back. */
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
  if (reactions.length === 0) return null;

  return (
    <div className={cn("-mt-1.5 flex flex-wrap gap-1 px-2", mine ? "justify-end" : "justify-start")}>
      {groupReactions(reactions, me).map((group) => (
        <button
          key={group.emoji}
          type="button"
          onClick={() => onToggle(group.emoji)}
          aria-label={`${group.emoji} ${group.count}${group.mine ? ", yours — press to remove" : ""}`}
          aria-pressed={group.mine}
          className={cn(
            "flex h-[22px] items-center gap-1 rounded-full border bg-[#1f1f1f] px-1.5 text-[13px] leading-none transition-colors",
            "focus-visible:outline-2 focus-visible:outline-white/60",
            group.mine ? "border-[var(--tt-red)]/70" : "border-[var(--tt-divider)] hover:bg-[var(--tt-shape-neutral-3)]",
          )}
        >
          <span>{group.emoji}</span>
          {group.count > 1 && <span className="text-[12px] text-[var(--tt-text-muted)]">{group.count}</span>}
        </button>
      ))}
    </div>
  );
}

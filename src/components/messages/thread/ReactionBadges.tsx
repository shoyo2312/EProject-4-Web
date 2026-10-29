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
    <div className={cn("relative z-[2] -mt-2 flex flex-wrap gap-1 px-3", mine ? "justify-end" : "justify-start")}>
      {groupReactions(reactions, me).map((group) => (
        <button
          key={group.emoji}
          type="button"
          onClick={() => onToggle(group.emoji)}
          aria-label={`${group.emoji} ${group.count}${group.mine ? ", yours — press to remove" : ""}`}
          aria-pressed={group.mine}
          className={cn(
            "flex h-6 items-center gap-1 rounded-full border bg-[var(--chat-raised)] px-2 text-[13px] leading-none shadow-[0_0_0_2px_var(--chat-thread)] transition-colors",
            "focus-visible:outline-2 focus-visible:outline-white/70",
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

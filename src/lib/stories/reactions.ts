import type { StoryReaction } from "@/lib/api/types";

/** The five reactions, in the order the bar shows them. Spelled as story-service spells them. */
export const REACTIONS: readonly { type: StoryReaction; emoji: string; label: string }[] = [
  { type: "LIKE", emoji: "👍", label: "Like" },
  { type: "LOVE", emoji: "❤️", label: "Love" },
  { type: "WOW", emoji: "😮", label: "Wow" },
  { type: "ANGRY", emoji: "😡", label: "Angry" },
  { type: "SAD", emoji: "😢", label: "Sad" },
];

export function emojiOf(type: StoryReaction): string {
  return REACTIONS.find((reaction) => reaction.type === type)?.emoji ?? "";
}

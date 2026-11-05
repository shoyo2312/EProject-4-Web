"use client";

import { ChatAvatar } from "@/components/messages/ChatAvatar";
import { cn } from "@/lib/utils";

/** The dots take turns: each starts a little after the one before. */
const DOT_DELAY = ["[animation-delay:0ms]", "[animation-delay:160ms]", "[animation-delay:320ms]"];

/**
 * Three dots that take turns, in a small bubble on the other person's side with their avatar — the
 * thread's "typing" row. Not a message: it is never in the list, never counted, never read.
 *
 * The row is always there, at a fixed height, whether or not anyone is typing: it appearing must not
 * move the list above it, so a reader going through history is not nudged and the "new message" button
 * has nothing to react to. Only its content comes and goes, fading in. With reduced motion the dots keep still.
 */
export function TypingRow({ active, name, avatar }: { active: boolean; name: string; avatar: string | undefined }) {
  return (
    <div className="flex h-6 flex-none items-center px-3">
      {active && (
        <div className="flex items-center gap-2 animate-in fade-in duration-200 motion-reduce:animate-none">
          <ChatAvatar src={avatar} className="h-6 w-6" />
          <div
            role="status"
            aria-label={`${name} is typing`}
            className="flex h-6 items-center gap-1 rounded-[var(--chat-radius-bubble)] bg-[var(--chat-recv)] px-3.5"
          >
            {DOT_DELAY.map((delay) => (
              <span
                key={delay}
                aria-hidden
                data-typing-dot
                className={cn(
                  "block h-1.5 w-1.5 rounded-full bg-[var(--tt-text-secondary)] opacity-60",
                  "animate-chat-typing motion-reduce:animate-none",
                  delay,
                )}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

import { MessagesIcon } from "@/components/icons";

export function EmptyThread() {
  return (
    <div className="flex h-full flex-col items-center justify-center px-6 text-center">
      <span className="flex h-20 w-20 items-center justify-center rounded-full bg-white/[0.06] ring-1 ring-[var(--chat-line)]">
        <MessagesIcon className="h-9 w-9 text-[var(--tt-text-secondary)]" />
      </span>
      <h2 className="mt-4 text-[20px] leading-6 font-bold text-[var(--tt-text)]">Your messages</h2>
      <p className="mt-1.5 max-w-xs text-[14px] leading-[21px] text-[var(--chat-meta)]">
        Pick a conversation, or open a profile and tap Message to start one.
      </p>
    </div>
  );
}

"use client";

import type { ReplyQuote } from "@/lib/api/conversations";
import { quoteText } from "@/lib/chat";
import { cn } from "@/lib/utils";

/**
 * What a reply points at, above the reply itself: "You replied" and the original in a quieter
 * bubble. The server decides what the viewer may see of the original — a recalled one and one the
 * viewer deleted arrive without content — so this only draws what it is given. Pressing it scrolls
 * to the original when that is on screen.
 */
export function ReplyQuoteBlock({
  quote,
  mine,
  peerName,
  onJump,
}: {
  quote: ReplyQuote;
  mine: boolean;
  peerName: string;
  onJump: (messageId: string) => void;
}) {
  const label = mine ? "You replied" : `${peerName} replied`;

  return (
    <div className={cn("flex max-w-[min(70%,480px)] flex-col", mine ? "items-end" : "items-start")}>
      <p className="px-1 text-[12px] leading-4 text-[var(--tt-text-muted)]">{label}</p>
      <button
        type="button"
        onClick={() => onJump(quote.messageId)}
        disabled={quote.state !== "OK"}
        aria-label={`${label}: ${describe(quote)}`}
        className={cn(
          "mt-0.5 max-w-full rounded-[16px] bg-[var(--tt-shape-neutral-3)] px-3 py-1.5 text-left text-[14px] leading-5",
          "focus-visible:outline-2 focus-visible:outline-white/60 disabled:cursor-default",
          quote.state === "OK" ? "text-[var(--tt-text-muted)]" : "text-[var(--tt-text-muted)] italic",
        )}
      >
        {quote.state === "OK" && quote.sticker ? (
          // eslint-disable-next-line @next/next/no-img-element -- a small public sticker image; next/image would need its host allow-listed
          <img src={quote.sticker.url} alt={quote.sticker.name} className="h-10 w-10 object-contain" />
        ) : (
          <span className="line-clamp-2 break-words [overflow-wrap:anywhere]">{describe(quote)}</span>
        )}
      </button>
    </div>
  );
}

function describe(quote: ReplyQuote): string {
  if (quote.state === "RECALLED") return "Message recalled";
  if (quote.state === "UNAVAILABLE") return "Message unavailable";
  return quoteText(quote.content, quote.type);
}

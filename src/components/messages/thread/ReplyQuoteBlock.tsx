"use client";

import { CornerUpLeft } from "lucide-react";

import { useChatImage } from "@/hooks/use-chat-image";
import type { ImageView, ReplyQuote } from "@/lib/api/conversations";
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
  animate = false,
}: {
  quote: ReplyQuote;
  mine: boolean;
  peerName: string;
  onJump: (messageId: string) => void;
  /** A reply that just arrived: the block slides in from the left. History shows at once. */
  animate?: boolean;
}) {
  const label = mine ? "You replied" : `${peerName} replied`;

  return (
    <div className={cn("flex max-w-[min(72%,520px)] flex-col", mine ? "items-end" : "items-start", animate && "motion-safe:animate-chat-quote-in")}>
      <p className="flex items-center gap-1 px-1 pb-1 text-[11.5px] leading-4 text-[var(--chat-meta)]">
        <CornerUpLeft aria-hidden className="h-3 w-3" />
        {label}
      </p>
      <button
        type="button"
        onClick={() => onJump(quote.messageId)}
        disabled={quote.state !== "OK"}
        aria-label={`${label}: ${describe(quote)}`}
        className={cn(
          // Tucked under the reply that follows it (which sits above, in front): hierarchy by depth, not by a second colour.
          "relative -mb-3 max-w-full rounded-[var(--chat-radius-bubble)] bg-white/[0.07] px-3.5 pt-2 pb-[18px] text-left text-[13.5px] leading-[19px]",
          mine ? "border-r-2 border-[var(--chat-line-strong)]" : "border-l-2 border-[var(--chat-line-strong)]",
          "focus-visible:outline-2 focus-visible:outline-white/70 disabled:cursor-default",
          quote.state === "OK" ? "text-[var(--chat-meta)]" : "text-[var(--chat-meta)] italic",
        )}
      >
        {quote.state === "OK" && quote.type === "VIDEO" && quote.video?.state === "AVAILABLE" && quote.video.thumbnailUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- a small thumbnail from the media store; next/image would need its host allow-listed
          <img src={quote.video.thumbnailUrl} alt="Video" className="h-14 w-10 rounded object-cover" />
        ) : quote.state === "OK" && quote.type === "IMAGE" && quote.image ? (
          <QuoteThumb image={quote.image} caption={quote.content} />
        ) : quote.state === "OK" && quote.sticker ? (
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

/** A quoted picture: a small thumbnail (the same authenticated fetch as the message) and its caption. */
function QuoteThumb({ image, caption }: { image: ImageView; caption: string | null }) {
  const loaded = useChatImage(image);
  return (
    <span className="flex items-center gap-2">
      {loaded.status === "ready" ? (
        // eslint-disable-next-line @next/next/no-img-element -- an object URL made from an authenticated fetch; next/image cannot load it
        <img src={loaded.src} alt="Photo" className="h-14 w-14 flex-none rounded object-cover" />
      ) : (
        <span aria-hidden className="h-14 w-14 flex-none rounded bg-white/[0.08]" />
      )}
      <span className="line-clamp-2 break-words [overflow-wrap:anywhere]">{caption?.trim() || "Photo"}</span>
    </span>
  );
}

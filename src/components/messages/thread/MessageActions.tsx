"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { EmojiAddIcon, ReplyIcon, TrashIcon } from "@/components/icons";
import { useEscapeKey } from "@/hooks/use-escape-key";
import { useMounted } from "@/hooks/use-mounted";
import { REACTION_EMOJIS } from "@/lib/chat";
import { cn } from "@/lib/utils";

const PICKER_GAP = 8;
const EDGE = 8;

const barButton =
  "flex h-6 w-6 flex-none items-center justify-center rounded-full text-[var(--tt-icon)] transition-colors hover:bg-[var(--tt-shape-neutral-3)] hover:text-[var(--tt-text)] focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-white/60";

/**
 * What can be done to one message: react, reply, delete. It sits beside the bubble and shows on
 * hover, on keyboard focus anywhere inside the row, and — where there is no hover — once the bubble
 * has been tapped (`pinned`). A recalled message has nothing to react to or quote, so only delete stays.
 *
 * The reaction picker is drawn in `document.body` at fixed coordinates: the history scrolls and clips
 * its own overflow, and the floating panel clips again, so a picker inside either would be cut off.
 */
export function MessageActions({
  mine,
  pinned,
  recalled,
  current,
  onReact,
  onReply,
  onDelete,
}: {
  mine: boolean;
  pinned: boolean;
  recalled: boolean;
  /** The viewer's own reaction to this message, highlighted in the picker. */
  current: string | null;
  onReact: (emoji: string) => void;
  onReply: () => void;
  onDelete: () => void;
}) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);

  return (
    <div
      className={cn(
        "absolute top-1/2 z-10 flex -translate-y-1/2 items-center",
        mine ? "right-full pr-1" : "left-full pl-1",
        "opacity-0 transition-opacity focus-within:opacity-100 group-hover/msg:opacity-100",
        (pinned || pickerOpen) && "opacity-100",
      )}
    >
      {!recalled && (
        <>
          <button
            ref={trigger}
            type="button"
            onClick={() => setPickerOpen((open) => !open)}
            aria-label="React to message"
            aria-haspopup="dialog"
            aria-expanded={pickerOpen}
            className={cn(barButton, pickerOpen && "bg-[var(--tt-shape-neutral-3)]")}
          >
            <EmojiAddIcon className="h-[18px] w-[18px]" />
          </button>
          <button type="button" onClick={onReply} aria-label="Reply" className={barButton}>
            <ReplyIcon className="h-[18px] w-[18px]" />
          </button>
        </>
      )}
      <button type="button" onClick={onDelete} aria-label="Delete message" className={barButton}>
        <TrashIcon className="h-[18px] w-[18px]" />
      </button>

      {pickerOpen && (
        <ReactionPicker
          anchor={trigger}
          current={current}
          onPick={(emoji) => {
            setPickerOpen(false);
            onReact(emoji);
          }}
          onClose={() => setPickerOpen(false)}
        />
      )}
    </div>
  );
}

function ReactionPicker({
  anchor,
  current,
  onPick,
  onClose,
}: {
  anchor: React.RefObject<HTMLButtonElement | null>;
  current: string | null;
  onPick: (emoji: string) => void;
  onClose: () => void;
}) {
  const mounted = useMounted();
  const root = useRef<HTMLDivElement>(null);
  const [place, setPlace] = useState<{ left: number; top: number } | null>(null);

  useEscapeKey(onClose);

  // Above the button, kept inside the viewport on both axes; below it when there is no room above.
  useLayoutEffect(() => {
    const button = anchor.current?.getBoundingClientRect();
    const box = root.current?.getBoundingClientRect();
    if (!button || !box) return;
    const left = Math.min(Math.max(EDGE, button.left + button.width / 2 - box.width / 2), window.innerWidth - box.width - EDGE);
    const above = button.top - box.height - PICKER_GAP;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- the position needs the picker's own measured size
    setPlace({ left, top: above >= EDGE ? above : button.bottom + PICKER_GAP });
  }, [anchor, mounted]);

  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (root.current?.contains(target) || anchor.current?.contains(target)) return;
      onClose();
    };
    // Scrolling or resizing moves the button away from fixed coordinates: close rather than float loose.
    window.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("resize", onClose);
    window.addEventListener("scroll", onClose, true);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("resize", onClose);
      window.removeEventListener("scroll", onClose, true);
    };
  }, [anchor, onClose]);

  if (!mounted) return null;

  return createPortal(
    <div
      ref={root}
      role="dialog"
      aria-label="Choose a reaction"
      style={place ? { left: place.left, top: place.top } : { left: 0, top: 0, visibility: "hidden" }}
      className="fixed z-[3002] flex gap-0.5 rounded-full border border-[var(--tt-divider)] bg-[#1f1f1f] p-1 shadow-[0_4px_16px_rgba(0,0,0,0.5)]"
    >
      {REACTION_EMOJIS.map((emoji) => (
        <button
          key={emoji}
          type="button"
          onClick={() => onPick(emoji)}
          aria-label={`React ${emoji}`}
          aria-pressed={current === emoji}
          className={cn(
            "flex h-9 w-9 items-center justify-center rounded-full text-[22px] leading-none transition-transform hover:scale-125 focus-visible:outline-2 focus-visible:outline-white/60",
            current === emoji && "bg-white/15",
          )}
        >
          {emoji}
        </button>
      ))}
    </div>,
    document.body,
  );
}

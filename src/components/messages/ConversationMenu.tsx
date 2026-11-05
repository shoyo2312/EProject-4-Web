"use client";

import { Ban, BellOff, Bell, Flag, Pin, PinOff, Timer, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { MoreHorizontalIcon } from "@/components/icons";
import { ConfirmDialog } from "@/components/messages/ConfirmDialog";
import { useChatUnreadContext } from "@/components/messages/ChatUnreadProvider";
import { MuteDialog } from "@/components/messages/MuteDialog";
import { ReportFlow } from "@/components/messages/report/ReportFlow";
import { toast } from "@/components/ui/toast";
import { useAnchoredPosition } from "@/hooks/use-anchored-position";
import { useEscapeKey } from "@/hooks/use-escape-key";
import { useMounted } from "@/hooks/use-mounted";
import { isApiError } from "@/lib/api/errors";
import type { ConversationResponse, MuteLength } from "@/lib/api/conversations";
import { block, unblock } from "@/lib/api/users";
import { chatErrorMessage, isMuted } from "@/lib/chat";
import { cn } from "@/lib/utils";

type Dialog = "mute" | "block" | "delete" | "report" | null;

const itemClass =
  "flex h-11 w-full items-center gap-3 rounded-[var(--chat-radius-control)] px-3 text-left text-[14.5px] font-medium text-[var(--tt-text)] transition-colors hover:bg-[var(--chat-active)] focus-visible:bg-[var(--chat-active)] focus-visible:outline-none";

/**
 * The "…" on a conversation in the inbox: mute, pin, report, block, delete. Report is the one that
 * reaches someone else (a moderator) and, like the rest, changes nothing about the conversation itself.
 *
 * The button is a sibling of the row's link, never inside it, so pressing it cannot open the thread
 * or touch the unread state. The menu is drawn in `document.body` at fixed coordinates, so the inbox's
 * scrolling area and the floating panel cannot clip it; it closes on Escape, on a press outside, on
 * scroll and after a choice, and puts focus back on the button.
 *
 * Mute, Block and Delete each ask first. Block reuses the account block (both directions, and the
 * server refuses the message on either transport); Delete removes the conversation from this account
 * only — it is not "decline request" and not "delete one message".
 */
export function ConversationMenu({
  item,
  name,
  otherId,
  active,
  open,
  onOpenChange,
  className,
}: {
  item: ConversationResponse;
  name: string;
  otherId: string;
  active: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  className?: string;
}) {
  const router = useRouter();
  const chat = useChatUnreadContext();
  const mounted = useMounted();
  const trigger = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const [dialog, setDialog] = useState<Dialog>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [returnFocus, setReturnFocus] = useState(false);

  const muted = isMuted(item, chat.nowMs);
  const pinned = item.pinnedAt !== null;
  const blockedByMe = item.blockedByViewer ?? chat.blockedUsers.has(otherId);

  const close = useCallback(() => onOpenChange(false), [onOpenChange]);
  const place = useAnchoredPosition(trigger, menu, open, close);
  useEscapeKey(() => {
    close();
    trigger.current?.focus();
  }, open);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (menu.current?.contains(target) || trigger.current?.contains(target)) return;
      close();
    };
    window.addEventListener("pointerdown", onPointerDown);
    return () => window.removeEventListener("pointerdown", onPointerDown);
  }, [open, close]);

  useEffect(() => {
    if (open && place) menu.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus();
  }, [open, place]);

  // A dialog that closes hands focus back to where the choice was made.
  useEffect(() => {
    if (dialog === null && returnFocus) {
      trigger.current?.focus();
      setReturnFocus(false);
    }
  }, [dialog, returnFocus]);

  const choose = (next: Dialog) => {
    close();
    setError(null);
    setDialog(next);
    setReturnFocus(true);
  };

  const closeDialog = () => {
    if (!busy) setDialog(null);
  };

  const run = async (action: () => Promise<unknown>) => {
    if (busy) return false;
    setBusy(true);
    setError(null);
    try {
      await action();
      return true;
    } catch (cause) {
      setError(chatErrorMessage(cause));
      return false;
    } finally {
      setBusy(false);
    }
  };

  /** Pin and unpin answer in a toast: there is no dialog to keep a refusal in. */
  const quick = async (action: () => Promise<unknown>) => {
    close();
    trigger.current?.focus();
    try {
      await action();
    } catch (cause) {
      toast.error(chatErrorMessage(cause));
    }
  };

  const confirmMute = async (length: MuteLength) => {
    if (await run(() => chat.mute(item.id, length))) setDialog(null);
  };

  const confirmBlock = async () => {
    const done = await run(async () => {
      try {
        await block(otherId);
      } catch (cause) {
        // Blocked from another tab already: the state the viewer asked for.
        if (!(isApiError(cause) && cause.is("ALREADY_BLOCKED"))) throw cause;
      }
      chat.setBlockedUser(otherId, true);
    });
    if (done) {
      setDialog(null);
      toast.success(`Blocked ${name}. Unblock them in Settings › Privacy.`);
    }
  };

  /** Unblocking needs no question: it only reopens the conversation. */
  const unblockNow = () =>
    quick(async () => {
      try {
        await unblock(otherId);
      } catch (cause) {
        // Already lifted from another tab: the state the viewer asked for.
        if (!(isApiError(cause) && cause.is("NOT_BLOCKED"))) throw cause;
      }
      chat.setBlockedUser(otherId, false);
      toast.success(`Unblocked ${name}.`);
    });

  const confirmDelete = async () => {
    const done = await run(() => chat.deleteConversation(item.id));
    if (done) {
      setDialog(null);
      if (active) router.replace("/messages");
    }
  };

  const onMenuKeyDown = (event: React.KeyboardEvent) => {
    const items = [...(menu.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? [])];
    const at = items.indexOf(document.activeElement as HTMLElement);
    const move = (index: number) => {
      event.preventDefault();
      items[(index + items.length) % items.length]?.focus();
    };
    if (event.key === "ArrowDown") move(at + 1);
    else if (event.key === "ArrowUp") move(at - 1);
    else if (event.key === "Home") move(0);
    else if (event.key === "End") move(items.length - 1);
    else if (event.key === "Tab") close();
  };

  return (
    <>
      <button
        ref={trigger}
        type="button"
        onClick={() => onOpenChange(!open)}
        aria-label={`More options for ${name}`}
        aria-haspopup="menu"
        aria-expanded={open}
        className={cn(
          "flex h-8 w-8 items-center justify-center rounded-full bg-[var(--tt-shape-neutral-3)] text-[var(--tt-text)] transition-colors hover:bg-white/20",
          "focus-visible:outline-2 focus-visible:outline-white/60",
          className,
        )}
      >
        <MoreHorizontalIcon className="h-5 w-5" />
      </button>

      {open &&
        mounted &&
        createPortal(
          <div
            ref={menu}
            role="menu"
            aria-label={`Options for ${name}`}
            onKeyDown={onMenuKeyDown}
            style={place ? { left: place.left, top: place.top } : { left: 0, top: 0 }}
            className={cn(
              "fixed z-[3002] w-[250px] overflow-hidden rounded-[var(--chat-radius-surface)] border border-[var(--chat-line)] bg-[var(--chat-pop)] p-1.5 shadow-[var(--chat-shadow-pop)] animate-in fade-in zoom-in-95 duration-150 motion-reduce:animate-none",
              !place && "pointer-events-none opacity-0",
            )}
          >
            {muted ? (
              <>
                <button type="button" role="menuitem" className={itemClass} onClick={() => void quick(() => chat.unmute(item.id))}>
                  <Bell aria-hidden className="h-5 w-5" />
                  Unmute notifications
                </button>
                <button type="button" role="menuitem" className={itemClass} onClick={() => choose("mute")}>
                  <Timer aria-hidden className="h-5 w-5" />
                  Change mute duration
                </button>
              </>
            ) : (
              <button type="button" role="menuitem" className={itemClass} onClick={() => choose("mute")}>
                <BellOff aria-hidden className="h-5 w-5" />
                Mute notifications
              </button>
            )}
            <button
              type="button"
              role="menuitem"
              className={itemClass}
              onClick={() => void quick(() => (pinned ? chat.unpin(item.id) : chat.pin(item.id)))}
            >
              {pinned ? <PinOff aria-hidden className="h-5 w-5" /> : <Pin aria-hidden className="h-5 w-5" />}
              {pinned ? "Unpin" : "Pin to top"}
            </button>
            <button type="button" role="menuitem" className={itemClass} onClick={() => choose("report")}>
              <Flag aria-hidden className="h-5 w-5" />
              Report
            </button>
            <button
              type="button"
              role="menuitem"
              className={itemClass}
              onClick={() => (blockedByMe ? void unblockNow() : choose("block"))}
            >
              <Ban aria-hidden className="h-5 w-5" />
              {blockedByMe ? "Unblock" : "Block"}
            </button>
            <button
              type="button"
              role="menuitem"
              className={cn(itemClass, "text-[var(--tt-red)]")}
              onClick={() => choose("delete")}
            >
              <Trash2 aria-hidden className="h-5 w-5" />
              Delete
            </button>
          </div>,
          document.body,
        )}

      {dialog === "report" && <ReportFlow conversationId={item.id} name={name} onClose={() => setDialog(null)} />}
      {dialog === "mute" && (
        <MuteDialog name={name} busy={busy} error={error} onCancel={closeDialog} onConfirm={(length) => void confirmMute(length)} />
      )}
      {dialog === "block" && (
        <ConfirmDialog
          title={`Block ${name}?`}
          confirmLabel="Block"
          busyLabel="Blocking…"
          danger
          busy={busy}
          error={error}
          onCancel={closeDialog}
          onConfirm={() => void confirmBlock()}
        >
          <p>
            You and {name} won&apos;t be able to send each other messages until you unblock them. They also
            won&apos;t be able to find your profile or videos, and you&apos;ll stop following each other —
            unblocking later won&apos;t bring the follows back. Your message history is kept.
          </p>
        </ConfirmDialog>
      )}
      {dialog === "delete" && (
        <ConfirmDialog
          title={`Delete chat with ${name}?`}
          confirmLabel="Delete"
          busyLabel="Deleting…"
          danger
          busy={busy}
          error={error}
          onCancel={closeDialog}
          onConfirm={() => void confirmDelete()}
        >
          <p>
            This removes the conversation and its current message history from your side, and it can&apos;t be
            restored in the app. {name} will still have their copy. New messages will start a fresh
            conversation on your side.
          </p>
        </ConfirmDialog>
      )}
    </>
  );
}

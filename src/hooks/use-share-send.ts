"use client";

import { useCallback, useRef, useState } from "react";

import { toast } from "@/components/ui/toast";
import { openConversation, sendMessage } from "@/lib/api/conversations";
import {
  runShare,
  togglePick,
  type ShareRecipient,
} from "@/lib/share-recipients";

export interface ReopenAsk {
  recipients: ShareRecipient[];
  answer: (confirmed: boolean) => void;
}

/**
 * One share sheet's worth of "send this video to these people": who is picked, the note, and what
 * happened to each person. Nothing is created until `send` — picking and typing are local.
 *
 * A person who got the video is remembered and left out of every later attempt; one who did not stays
 * picked, with the reason, to be tried again under the same attempt id, so a response that was lost
 * on the way back cannot turn into a second message.
 */
export function useShareSend(videoId: string, onDelivered: (count: number) => void, onFinished: () => void) {
  const [picked, setPicked] = useState<ReadonlyMap<string, ShareRecipient>>(new Map());
  const [note, setNote] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState<ReadonlySet<string>>(new Set());
  const [failures, setFailures] = useState<Readonly<Record<string, string>>>({});
  const [reopenAsk, setReopenAsk] = useState<ReopenAsk | null>(null);
  const attemptId = useRef<string | null>(null);
  /** The synchronous twin of `sending`: two clicks in one frame both see the state as idle. */
  const inFlight = useRef(false);

  const toggle = useCallback((recipient: ShareRecipient) => {
    if (inFlight.current) return;
    setPicked((current) => togglePick(current, recipient));
    setFailures((current) => {
      if (!(recipient.userId in current)) return current;
      const { [recipient.userId]: _cleared, ...rest } = current;
      void _cleared;
      return rest;
    });
  }, []);

  const send = useCallback(async () => {
    if (inFlight.current || picked.size === 0) return;
    inFlight.current = true;
    setSending(true);
    setFailures({});
    attemptId.current ??= crypto.randomUUID();

    try {
      const results = await runShare(
        { videoId, note, attemptId: attemptId.current, recipients: [...picked.values()], alreadySent: sent },
        {
          openConversation,
          sendMessage,
          confirmReopen: (recipients) =>
            new Promise<boolean>((resolve) =>
              setReopenAsk({
                recipients,
                answer: (confirmed) => {
                  setReopenAsk(null);
                  resolve(confirmed);
                },
              }),
            ),
        },
      );
      // Declined: nothing was sent, and the picks and the note stay as they were.
      if (!results) return;

      const delivered = [...results].filter(([, result]) => result.ok).map(([userId]) => userId);
      const failed: Record<string, string> = {};
      for (const [userId, result] of results) if (!result.ok) failed[userId] = result.reason;

      if (delivered.length > 0) {
        setSent((current) => new Set([...current, ...delivered]));
        setPicked((current) => {
          const next = new Map(current);
          delivered.forEach((userId) => next.delete(userId));
          return next;
        });
        onDelivered(delivered.length);
      }
      setFailures(failed);

      const failedCount = Object.keys(failed).length;
      if (failedCount === 0) {
        toast.success(delivered.length === 1 ? "Sent." : `Sent to ${delivered.length} people.`);
        onFinished();
      } else if (delivered.length > 0) {
        toast.warning(`Sent to ${delivered.length} of ${delivered.length + failedCount}. The rest can be tried again.`);
      }
    } finally {
      inFlight.current = false;
      setSending(false);
    }
  }, [picked, note, sent, videoId, onDelivered, onFinished]);

  return { picked, note, setNote, sending, sent, failures, reopenAsk, toggle, send };
}

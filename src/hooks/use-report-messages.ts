"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { listMessages, type MessageResponse } from "@/lib/api/conversations";
import { chatErrorMessage } from "@/lib/chat";

const PAGE = 50;

/**
 * The conversation's history for the report picker, one page at a time, oldest first. It reads over
 * REST and opens no socket: the thread behind the picker keeps its own subscription, so there is only
 * ever one. What is picked lives outside this hook, so loading older pages never moves a tick.
 */
export function useReportMessages(conversationId: string) {
  const [messages, setMessages] = useState<MessageResponse[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const cursor = useRef<string | null>(null);
  const busy = useRef(false);
  const [generation, setGeneration] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    busy.current = true;
    cursor.current = null;
    setLoading(true);
    setError(null);
    listMessages(conversationId, null, controller.signal, PAGE)
      .then((page) => {
        setMessages([...page.items].reverse());
        setHasMore(page.hasMore);
        cursor.current = page.nextCursor;
      })
      .catch((cause) => {
        if (!controller.signal.aborted) setError(chatErrorMessage(cause));
      })
      .finally(() => {
        busy.current = false;
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [conversationId, generation]);

  const loadMore = useCallback(async () => {
    if (busy.current || !cursor.current) return false;
    busy.current = true;
    try {
      const page = await listMessages(conversationId, cursor.current, undefined, PAGE);
      cursor.current = page.nextCursor;
      setHasMore(page.hasMore);
      setMessages((current) => {
        const known = new Set(current.map((m) => m.id));
        return [...[...page.items].reverse().filter((m) => !known.has(m.id)), ...current];
      });
      return true;
    } catch (cause) {
      setError(chatErrorMessage(cause));
      return false;
    } finally {
      busy.current = false;
    }
  }, [conversationId]);

  const reload = useCallback(() => setGeneration((n) => n + 1), []);

  return { messages, hasMore, loading, error, loadMore, reload };
}

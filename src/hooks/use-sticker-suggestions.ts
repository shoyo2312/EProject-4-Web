"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { fetchStickerSuggestions, fetchSuggestionTopics, type StickerView } from "@/lib/api/conversations";
import {
  compileTopics,
  isSuggestionMuted,
  matchSuggestionTopic,
  recordSuggestionDismissed,
  recordSuggestionUsed,
  type CompiledSuggestionTopic,
} from "@/lib/chat-sticker-suggestions";

export const SUGGESTION_DEBOUNCE_MS = 500;
const POOL_TTL_MS = 10 * 60 * 1000;
const NONE: StickerView[] = [];

let topicsPromise: Promise<CompiledSuggestionTopic[]> | null = null;
let loadedTopics: CompiledSuggestionTopic[] | null = null;
const pools = new Map<string, { stickers: StickerView[]; at: number }>();

function loadTopics(): Promise<CompiledSuggestionTopic[]> {
  topicsPromise ??= fetchSuggestionTopics().then(
    (topics) => (loadedTopics = compileTopics(topics)),
    (error: unknown) => {
      topicsPromise = null;
      throw error;
    },
  );
  return topicsPromise;
}

function loadPool(topicId: string, signal: AbortSignal): Promise<StickerView[]> {
  const cached = pools.get(topicId);
  if (cached && Date.now() - cached.at < POOL_TTL_MS) return Promise.resolve(cached.stickers);
  return fetchStickerSuggestions(topicId, signal).then((stickers) => {
    pools.set(topicId, { stickers, at: Date.now() });
    return stickers;
  });
}

/** Forgets what was fetched, so a test starts from nothing. */
export function resetStickerSuggestionCaches(): void {
  topicsPromise = null;
  loadedTopics = null;
  pools.clear();
}

/**
 * Stickers to offer for what is being typed. A suggestion appears only for a short message that
 * contains a listed feeling or greeting, after a pause in typing, and not in a conversation that was told
 * to stop; the text is matched here and only the topic's name goes to the server. Nothing is fetched for
 * a message that matches nothing, and nothing is asked of the server until something is typed.
 *
 * `dismiss` is the person closing the bar, `ignore` sending their message past it, `used` sending one of
 * its stickers. Each takes the topic off for the rest of this visit; closing or ignoring twice in a row
 * also silences the conversation for a day (see `chat-sticker-suggestions`).
 */
export function useStickerSuggestions({
  scope,
  text,
  enabled,
}: {
  scope: string | undefined;
  text: string;
  enabled: boolean;
}): { stickers: StickerView[]; dismiss: () => void; ignore: () => void; used: () => void } {
  const active = enabled && scope !== undefined;
  const hasText = text.trim() !== "";
  const [topics, setTopics] = useState<CompiledSuggestionTopic[] | null>(loadedTopics);
  const [dismissed, setDismissed] = useState<ReadonlySet<string>>(() => new Set());
  const [muteVersion, setMuteVersion] = useState(0);
  const [settled, setSettled] = useState<string | null>(null);
  const [pool, setPool] = useState<{ topicId: string; stickers: StickerView[] } | null>(null);

  useEffect(() => {
    if (!active || !hasText || topics !== null) return;
    let live = true;
    loadTopics().then(
      (loaded) => {
        if (live) setTopics(loaded);
      },
      () => {},
    );
    return () => {
      live = false;
    };
  }, [active, hasText, topics]);

  const candidate = useMemo(
    () => (active && topics ? matchSuggestionTopic(text, topics) : null),
    [active, topics, text],
  );
  // eslint-disable-next-line react-hooks/exhaustive-deps -- muteVersion is how a new silence is noticed
  const muted = useMemo(() => (candidate !== null && scope !== undefined ? isSuggestionMuted(scope) : false), [candidate, scope, muteVersion]);
  const topic = candidate !== null && !muted && !dismissed.has(candidate) ? candidate : null;

  useEffect(() => {
    if (topic === null) return;
    const timer = setTimeout(() => setSettled(topic), SUGGESTION_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [topic]);

  const ready = topic !== null && settled === topic;
  useEffect(() => {
    if (!ready || topic === null) return;
    const controller = new AbortController();
    loadPool(topic, controller.signal).then(
      (stickers) => setPool({ topicId: topic, stickers }),
      () => {
        if (!controller.signal.aborted) setPool({ topicId: topic, stickers: [] });
      },
    );
    return () => controller.abort();
  }, [ready, topic]);

  const stickers = ready && pool?.topicId === topic ? pool.stickers : NONE;

  const closeTopic = useCallback(() => {
    if (topic === null) return;
    setDismissed((current) => new Set(current).add(topic));
  }, [topic]);

  const dismiss = useCallback(() => {
    if (topic === null || scope === undefined) return;
    closeTopic();
    if (recordSuggestionDismissed(scope)) setMuteVersion((version) => version + 1);
  }, [topic, scope, closeTopic]);

  const ignore = useCallback(() => {
    if (stickers.length > 0) dismiss();
  }, [stickers.length, dismiss]);

  const used = useCallback(() => {
    if (topic === null || scope === undefined) return;
    closeTopic();
    recordSuggestionUsed(scope);
  }, [topic, scope, closeTopic]);

  return { stickers, dismiss, ignore, used };
}

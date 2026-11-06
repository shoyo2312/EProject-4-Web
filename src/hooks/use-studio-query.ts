"use client";

import { useEffect, useState } from "react";

import { messageFor } from "@/lib/api/errors";

export interface StudioQuery<T> {
  data: T | null;
  error: string | null;
  /** Fetches again with the same inputs — after an edit made elsewhere on the page. */
  reload: () => void;
}

/**
 * One Studio request per change of `key`: the previous one is aborted, so a
 * range picked twice in a row cannot land its first answer last. `data` keeps
 * the last answer while the next one loads, which keeps the page from blinking
 * to skeletons on every switch — but not past a failure of the next key, where
 * it would read as that key's answer.
 */
export function useStudioQuery<T>(
  key: string,
  load: (signal: AbortSignal) => Promise<T>,
): StudioQuery<T> {
  const [answer, setAnswer] = useState<{ key: string; value: T } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [round, setRound] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    load(controller.signal)
      .then((value) => {
        setAnswer({ key, value });
        setError(null);
      })
      .catch((cause: unknown) => {
        if (controller.signal.aborted) return;
        setError(messageFor(cause));
        setAnswer((last) => (last?.key === key ? last : null));
      });
    return () => controller.abort();
    // `load` is a fresh closure every render; `key` is what says the inputs changed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, round]);

  return { data: answer ? answer.value : null, error, reload: () => setRound((value) => value + 1) };
}

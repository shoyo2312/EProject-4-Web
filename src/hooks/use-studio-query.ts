"use client";

import { useEffect, useRef, useState } from "react";

import { messageFor } from "@/lib/api/errors";

/**
 * How often Studio's analytics ask again when nothing announced a change — views, comments and
 * shares on the creator's other posts push no frame to their Studio (likes and follows do, see
 * `useStudioPulse`).
 */
export const ANALYTICS_REFRESH_MS = 15_000;

export interface StudioQuery<T> {
  data: T | null;
  error: string | null;
  /** Fetches again with the same inputs — after an edit made elsewhere on the page. */
  reload: () => void;
  /** Like `reload`, but a failure keeps the answer on screen and shows no error. */
  refresh: () => void;
}

/**
 * One Studio request per change of `key`: the previous one is aborted, so a
 * range picked twice in a row cannot land its first answer last. `data` keeps
 * the last answer while the next one loads, which keeps the page from blinking
 * to skeletons on every switch — but not past a failure of the next key, where
 * it would read as that key's answer.
 *
 * `refreshMs`: asks again on that interval while the tab is visible, for numbers that move
 * without anything announcing it. A refresh that fails keeps the answer on screen, quietly.
 */
export function useStudioQuery<T>(
  key: string,
  load: (signal: AbortSignal) => Promise<T>,
  refreshMs?: number,
): StudioQuery<T> {
  const [answer, setAnswer] = useState<{ key: string; value: T } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [round, setRound] = useState(0);
  const refreshing = useRef(false);
  const refresh = () => {
    refreshing.current = true;
    setRound((value) => value + 1);
  };

  useEffect(() => {
    if (!refreshMs) return;
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") refresh();
    }, refreshMs);
    return () => window.clearInterval(timer);
  }, [refreshMs]);

  useEffect(() => {
    const quiet = refreshing.current && answer?.key === key;
    refreshing.current = false;
    const controller = new AbortController();
    load(controller.signal)
      .then((value) => {
        setAnswer({ key, value });
        setError(null);
      })
      .catch((cause: unknown) => {
        if (controller.signal.aborted || quiet) return;
        setError(messageFor(cause));
        setAnswer((last) => (last?.key === key ? last : null));
      });
    return () => controller.abort();
    // `load` is a fresh closure every render; `key` is what says the inputs changed, and `answer`
    // is read only to tell a quiet refresh from a first load.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, round]);

  return { data: answer ? answer.value : null, error, reload: () => setRound((value) => value + 1), refresh };
}

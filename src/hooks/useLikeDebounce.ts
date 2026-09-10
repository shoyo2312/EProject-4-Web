import { useCallback, useEffect, useRef, useState } from "react";

const WINDOW_MS = 500;

/**
 * Optimistic like state with one request per burst.
 *
 * The UI flips on every tap; only the state the user settles on is sent, and only when it differs
 * from what the server already holds. Ten taps that land back where they started cost zero
 * requests — which is the point, because every request that does go out becomes a Kafka event, a
 * realtime frame, and eventually a notification to the video's owner.
 */
export function useLikeDebounce(
  serverLiked: boolean,
  send: (liked: boolean) => Promise<unknown>,
) {
  const [liked, setLiked] = useState(serverLiked);
  const confirmed = useRef(serverLiked);
  const desired = useRef(serverLiked);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // A counts frame or a refetch can move the server's value while nothing is
  // pending. This is a real effect, not a derived-render calculation: it
  // syncs local state to a value that lives outside this hook's props
  // (`confirmed`/`desired`/`timer`) and reads refs to decide whether to
  // apply it, both of which the "adjust state during render" pattern
  // forbids — refs are read here deliberately, not incidentally.
  useEffect(() => {
    if (timer.current === null) {
      confirmed.current = serverLiked;
      desired.current = serverLiked;
      // eslint-disable-next-line react-hooks/set-state-in-effect -- imperative debounce sync (refs decide whether to apply it), not a render-derived value
      setLiked(serverLiked);
    }
  }, [serverLiked]);

  const flush = useCallback(() => {
    timer.current = null;
    const target = desired.current;
    if (target === confirmed.current) {
      return;
    }
    confirmed.current = target;
    send(target).catch(() => {
      // Includes a 429 from the server-side bucket. The server's value is the one that counts.
      confirmed.current = !target;
      desired.current = !target;
      setLiked(!target);
    });
  }, [send]);

  const toggle = useCallback(() => {
    desired.current = !desired.current;
    setLiked(desired.current);
    if (timer.current !== null) {
      clearTimeout(timer.current);
    }
    timer.current = setTimeout(flush, WINDOW_MS);
  }, [flush]);

  // Leaving the page mid-window must not drop the tap.
  useEffect(() => {
    return () => {
      if (timer.current !== null) {
        clearTimeout(timer.current);
        flush();
      }
    };
  }, [flush]);

  return { liked, toggle };
}

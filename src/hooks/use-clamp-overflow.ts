import { useLayoutEffect, useState, type RefObject } from "react";

/**
 * True when the ref's content is taller than its clamped box — i.e. the text
 * is actually being cut off. Recomputed whenever `text` changes, since a
 * clamped element's `clientHeight` doesn't change on its own as content does.
 */
export function useClampOverflow(
  ref: RefObject<HTMLElement | null>,
  text: string,
): boolean {
  const [isOverflowing, setIsOverflowing] = useState(false);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    setIsOverflowing(el.scrollHeight > el.clientHeight + 1);
  }, [ref, text]);

  return isOverflowing;
}

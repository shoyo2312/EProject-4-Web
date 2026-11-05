import { useEffect, useState } from "react";

/** The value once it has stopped changing for `ms`: Studio's search boxes query on this, not on every key. */
export function useDebounced<T>(value: T, ms: number): T {
  const [settled, setSettled] = useState(value);
  useEffect(() => {
    const id = window.setTimeout(() => setSettled(value), ms);
    return () => window.clearTimeout(id);
  }, [value, ms]);
  return settled;
}

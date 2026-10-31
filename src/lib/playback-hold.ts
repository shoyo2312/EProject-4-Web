/**
 * Holds every player still while something covers the whole app — the daily
 * screen time limit's cover, or the Sleep hours screen. A module-level store rather than a context, so
 * the feed's cards and the story player can read it without a provider above
 * each of them; `usePlaybackHeld` subscribes to it.
 */

let holds = 0;
const listeners = new Set<() => void>();

function changed(): void {
  listeners.forEach((listener) => listener());
}

/** Holds playback until the returned release is called (calling it again does nothing). */
export function holdPlayback(): () => void {
  holds += 1;
  changed();
  let released = false;
  return () => {
    if (released) return;
    released = true;
    holds -= 1;
    changed();
  };
}

export function playbackHeld(): boolean {
  return holds > 0;
}

export function subscribePlaybackHold(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

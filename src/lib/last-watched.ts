/**
 * The video the viewer most recently played, so a profile grid can mark that
 * tile "Just watched" — the cue TikTok gives when you open a creator's page
 * from one of their clips and want to find where you were.
 *
 * Kept in `sessionStorage`: it survives a reload of the profile page but not a
 * new tab, which is the scope of "just". One id, not a history — the grid only
 * ever marks the latest.
 */

const KEY = "tt:last-watched";

export function markLastWatched(videoId: string) {
  try {
    window.sessionStorage.setItem(KEY, videoId);
  } catch {
    // Storage disabled (private mode, quota): the label is a nicety, not data.
  }
}

/** The id recorded by `markLastWatched`, or `null` when nothing played yet. */
export function getLastWatchedId(): string | null {
  try {
    return window.sessionStorage.getItem(KEY);
  } catch {
    return null;
  }
}

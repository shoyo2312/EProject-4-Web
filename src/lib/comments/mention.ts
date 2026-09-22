import type { UserProfileResponse } from "@/lib/api/types";

/** The "@word" under the caret: where it starts and what has been typed after the "@". */
export interface MentionToken {
  start: number;
  query: string;
}

/** How many accounts the mention list offers at once. */
export const MENTION_LIMIT = 6;
/** Same debounce as the search drawer — one request per pause, not per key. */
export const MENTION_DEBOUNCE_MS = 250;

/** The "@word" being typed at the caret, if there is one. */
export function mentionTokenAt(
  value: string,
  caret: number,
): MentionToken | null {
  const before = value.slice(0, caret);
  const at = before.lastIndexOf("@");
  // Only a fresh word starts a mention: "a@b" is an address, not a tag.
  if (at === -1 || (at > 0 && !/\s/.test(before[at - 1]))) return null;
  const query = before.slice(at + 1);
  // A space ends the token — the mention list closes rather than following on.
  return /\s/.test(query) ? null : { start: at, query };
}

/**
 * What gets typed into the comment. Most backend accounts have no handle
 * (user-service stores none for older rows), so the display name stands in with
 * its spaces squeezed out — a mention is plain text here, not an entity the API
 * resolves, so it only has to read as one.
 */
export function mentionHandle(profile: UserProfileResponse): string {
  if (profile.username) return profile.username;
  const name = profile.displayName ?? `user${profile.userId}`;
  return name.replace(/\s+/g, "");
}

/**
 * Splits comment text into plain runs and "@handle" runs, in order, for a
 * render-time highlight. Same rule the composer tags by: a mention starts a
 * word, so "mail@x.com" stays plain text.
 */
export function splitMentions(text: string): { text: string; mention: boolean }[] {
  const parts = text.split(/(@[\p{L}\p{N}_.]+)/gu);
  return parts
    .map((part, i) => ({
      text: part,
      mention:
        part.length > 1 &&
        part.startsWith("@") &&
        (i === 0 || parts[i - 1] === "" || /\s$/.test(parts[i - 1])),
    }))
    .filter((run) => run.text !== "");
}

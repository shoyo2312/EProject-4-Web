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
 * What gets typed into the comment. The handle is what makes it work: the
 * comment links "@handle" to `/@handle`, and notification-service resolves it
 * by username to tell the account it was tagged. The squeezed display name is
 * only a last resort for a profile with no username, which reaches nobody.
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
  // Never ends on a period: in "thanks @bob." the period ends the sentence.
  const parts = text.split(/(@[\p{L}\p{N}_.]*[\p{L}\p{N}_])/gu);
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

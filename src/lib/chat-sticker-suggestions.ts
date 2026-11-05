import type { SuggestionTopic } from "@/lib/api/conversations";

/** Past this many words a message is a sentence, not a feeling, and earns no suggestion. */
export const MAX_SUGGESTION_WORDS = 3;
export const MAX_SUGGESTION_LENGTH = 30;

/** Closing the suggestions this many times in a row, without sending one, silences them for a while. */
export const DISMISS_LIMIT = 2;
export const MUTE_MS = 24 * 60 * 60 * 1000;

export const SUGGESTION_MUTE_KEY = "tt.chat.sticker-suggest.v1";
const MAX_TRACKED_CONVERSATIONS = 200;

/**
 * Lower case, no diacritics, only letters and digits, single spaces: "Buồn  ngủ!" and "buon ngu" are
 * the same text. People type Vietnamese with and without marks, and the word list is written with them.
 */
export function normalizeForMatch(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/gi, "d")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

export interface CompiledSuggestionTopic {
  id: string;
  /** Normalised, so a phrase is matched on word boundaries by comparing padded strings. */
  keywords: string[];
  patterns: RegExp[];
}

/** Prepares the server's table for matching. A pattern that does not compile is dropped, not fatal. */
export function compileTopics(topics: readonly SuggestionTopic[]): CompiledSuggestionTopic[] {
  return topics.map((topic) => ({
    id: topic.id,
    keywords: topic.keywords.map(normalizeForMatch).filter((keyword) => keyword !== ""),
    patterns: topic.patterns.flatMap((source) => {
      try {
        return [new RegExp(source, "u")];
      } catch {
        return [];
      }
    }),
  }));
}

/**
 * The topic a short message is about, or null. A message earns one only if it is short (at most
 * {@link MAX_SUGGESTION_WORDS} words) and contains a listed word or phrase; the longest match wins, so
 * "buồn ngủ" is sleepy, not sad, and "hihi" is happy, not a hello. Nothing else does — "ok", "ừ",
 * "mai đi ăn ở đâu" get nothing.
 */
export function matchSuggestionTopic(text: string, topics: readonly CompiledSuggestionTopic[]): string | null {
  const normalized = normalizeForMatch(text);
  if (normalized === "" || normalized.length > MAX_SUGGESTION_LENGTH) return null;
  const words = normalized.split(" ");
  if (words.length > MAX_SUGGESTION_WORDS) return null;

  const padded = ` ${normalized} `;
  let best: { id: string; length: number } | null = null;
  const consider = (id: string, length: number) => {
    if (!best || length > best.length) best = { id, length };
  };
  for (const topic of topics) {
    for (const keyword of topic.keywords) {
      if (padded.includes(` ${keyword} `)) consider(topic.id, keyword.length);
    }
    for (const word of words) {
      if (topic.patterns.some((pattern) => pattern.test(word))) consider(topic.id, word.length);
    }
  }
  return best === null ? null : (best as { id: string }).id;
}

interface MuteState {
  /** Suggestions closed since the last one was sent or the last silence began. */
  dismissed: number;
  /** Epoch millis until which this conversation gets none; 0 when it is not silenced. */
  mutedUntil: number;
}

type MuteStore = Record<string, MuteState>;

function readStore(): MuteStore {
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(SUGGESTION_MUTE_KEY) ?? "{}");
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return {};
    const store: MuteStore = {};
    for (const [key, value] of Object.entries(parsed)) {
      const v = value as Partial<MuteState> | null;
      if (v && typeof v.dismissed === "number" && typeof v.mutedUntil === "number") {
        store[key] = { dismissed: v.dismissed, mutedUntil: v.mutedUntil };
      }
    }
    return store;
  } catch {
    return {};
  }
}

/** Keeps what still matters — a count in progress or a silence not yet over — and bounds the size. */
function writeStore(store: MuteStore, now: number): void {
  const live = Object.entries(store)
    .filter(([, state]) => state.dismissed > 0 || state.mutedUntil > now)
    .slice(-MAX_TRACKED_CONVERSATIONS);
  try {
    window.localStorage.setItem(SUGGESTION_MUTE_KEY, JSON.stringify(Object.fromEntries(live)));
  } catch {
    // Private mode or a full store: suggestions still work, they just forget between visits.
  }
}

/** Whether this conversation has been told to stop suggesting stickers, on this browser. */
export function isSuggestionMuted(conversationId: string, now: number = Date.now()): boolean {
  return (readStore()[conversationId]?.mutedUntil ?? 0) > now;
}

/**
 * The person closed a suggestion, or sent their message past it. {@link DISMISS_LIMIT} of those in a
 * row silence this conversation for {@link MUTE_MS}; the count starts again afterwards. Returns whether
 * it is now silenced.
 */
export function recordSuggestionDismissed(conversationId: string, now: number = Date.now()): boolean {
  const store = readStore();
  // Re-insert last, so the cap drops the conversations least recently touched.
  const current = store[conversationId];
  delete store[conversationId];
  const dismissed = (current && current.mutedUntil <= now ? current.dismissed : 0) + 1;
  const muted = dismissed >= DISMISS_LIMIT;
  store[conversationId] = muted ? { dismissed: 0, mutedUntil: now + MUTE_MS } : { dismissed, mutedUntil: current?.mutedUntil ?? 0 };
  writeStore(store, now);
  return muted;
}

/** A suggested sticker was sent: the person finds them useful, so the count of ignored ones starts over. */
export function recordSuggestionUsed(conversationId: string, now: number = Date.now()): void {
  const store = readStore();
  const current = store[conversationId];
  if (!current || current.dismissed === 0) return;
  store[conversationId] = { ...current, dismissed: 0 };
  writeStore(store, now);
}

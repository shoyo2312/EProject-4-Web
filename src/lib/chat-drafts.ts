/**
 * Unsent message text, kept per signed-in account and conversation so that leaving a thread, opening
 * another, or reloading the page does not lose it. Text only: no token, no reply target and no
 * attachment is stored (a reply's message may be gone and a picture's upload expires by then).
 *
 * The map lives in memory and every change reaches subscribers at once; `localStorage` is written a
 * moment later (typing would otherwise write on every key) and immediately by `flushDrafts`, which the
 * thread calls when it unmounts and which also runs when the page is hidden. Another tab's change comes
 * in through the `storage` event, so two tabs converge on whichever wrote last.
 */

const PREFIX = "tt:chat-drafts:v1:";
const WRITE_DELAY_MS = 300;
/** A preview is one line of a list row; the row truncates, this just bounds what is rendered. */
const PREVIEW_CHARS = 120;

type DraftMap = Record<string, string>;

const maps = new Map<string, DraftMap>();
const listeners = new Set<() => void>();
const dirty = new Set<string>();
let timer: ReturnType<typeof setTimeout> | null = null;
let hooked = false;

function storage(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

function parse(raw: string | null): DraftMap {
  if (!raw) return {};
  try {
    const value: unknown = JSON.parse(raw);
    if (typeof value !== "object" || value === null || Array.isArray(value)) return {};
    const out: DraftMap = {};
    for (const [id, text] of Object.entries(value)) {
      if (typeof text === "string" && text.trim() !== "") out[id] = text;
    }
    return out;
  } catch {
    return {};
  }
}

function load(userId: string): DraftMap {
  let map = maps.get(userId);
  if (!map) {
    map = parse(storage()?.getItem(PREFIX + userId) ?? null);
    maps.set(userId, map);
  }
  return map;
}

function emit() {
  listeners.forEach((listener) => listener());
}

function hook() {
  if (hooked || typeof window === "undefined") return;
  hooked = true;
  window.addEventListener("storage", (event) => {
    if (!event.key?.startsWith(PREFIX)) return;
    maps.delete(event.key.slice(PREFIX.length));
    emit();
  });
  window.addEventListener("pagehide", flushDrafts);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") flushDrafts();
  });
}

/** Writes pending changes now. Safe to call at any time, including when nothing is pending. */
export function flushDrafts() {
  if (timer !== null) {
    clearTimeout(timer);
    timer = null;
  }
  const store = storage();
  for (const userId of dirty) {
    const map = maps.get(userId) ?? {};
    try {
      if (Object.keys(map).length === 0) store?.removeItem(PREFIX + userId);
      else store?.setItem(PREFIX + userId, JSON.stringify(map));
    } catch {
      // Storage full or blocked: the draft still lives in memory for this page.
    }
  }
  dirty.clear();
}

/** The draft for a conversation, or "" when there is none. */
export function getDraft(userId: string, conversationId: string): string {
  if (!userId) return "";
  return load(userId)[conversationId] ?? "";
}

/** Saves `text`; whitespace only counts as nothing, so emptying the box removes the draft. */
export function saveDraft(userId: string, conversationId: string, text: string) {
  if (!userId) return;
  hook();
  const current = load(userId);
  const has = conversationId in current;
  if (text.trim() === "") {
    if (!has) return;
    const { [conversationId]: _removed, ...rest } = current;
    void _removed;
    maps.set(userId, rest);
  } else {
    if (current[conversationId] === text) return;
    maps.set(userId, { ...current, [conversationId]: text });
  }
  dirty.add(userId);
  if (timer === null) timer = setTimeout(flushDrafts, WRITE_DELAY_MS);
  emit();
}

export function clearDraft(userId: string, conversationId: string) {
  saveDraft(userId, conversationId, "");
}

/** The account's drafts as one object that changes identity only when a draft changes (for `useSyncExternalStore`). */
export function draftsSnapshot(userId: string): DraftMap {
  return userId ? load(userId) : EMPTY;
}

const EMPTY: DraftMap = {};

export function subscribeDrafts(listener: () => void): () => void {
  hook();
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** One line for a list row: line breaks and runs of spaces collapse, and a very long draft is cut. */
export function draftPreview(text: string): string {
  const flat = text.replace(/\s+/g, " ").trim();
  const chars = Array.from(flat);
  return chars.length > PREVIEW_CHARS ? `${chars.slice(0, PREVIEW_CHARS).join("")}…` : flat;
}

/** Test seam: forget everything held in memory and any pending write. */
export function resetDraftsForTest() {
  if (timer !== null) clearTimeout(timer);
  timer = null;
  dirty.clear();
  maps.clear();
}

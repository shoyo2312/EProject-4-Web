"use client";

import { createContext, useCallback, useContext, useMemo, useSyncExternalStore } from "react";

/** localStorage key holding the serialised {@link PlayerSettings}. */
const STORAGE_KEY = "tt:player-settings";

/**
 * The speeds the overflow menu offers, in its order. The list lives here rather
 * than next to the menu because it is the persisted value's domain: `speed` is
 * read back out of user-writable storage and has to be validated against it.
 */
export const SPEEDS = [0.75, 1, 1.25, 1.5, 2] as const;

interface PlayerSettings {
  /** Sound preference, shared by every player in the app. */
  muted: boolean;
  /** Output level, 0–1. Kept while muted so unmuting restores the old level. */
  volume: number;
  /** Playback rate, one of {@link SPEEDS}. */
  speed: number;
  /** Whether finishing a clip steps to the next one instead of looping. */
  autoScroll: boolean;
}

/** `muted` is also the only state a browser will autoplay, hence the default. */
const DEFAULTS: PlayerSettings = {
  muted: true,
  volume: 1,
  speed: 1,
  autoScroll: false,
};

interface PlayerSettingsValue extends PlayerSettings {
  toggleMuted: () => void;
  /**
   * Forces the muted state, keeping the volume level. Used when the browser
   * refuses unmuted autoplay, so the UI agrees with the element.
   */
  mute: () => void;
  /**
   * Drives the slider. The mute flag follows it, because dragging off zero has
   * to unmute and dragging to zero has to mute — otherwise the icon contradicts
   * the knob.
   */
  changeVolume: (volume: number) => void;
  setSpeed: (speed: number) => void;
  setAutoScroll: (on: boolean) => void;
}

const PlayerSettingsContext = createContext<PlayerSettingsValue | null>(null);

export function usePlayerSettings(): PlayerSettingsValue {
  const value = useContext(PlayerSettingsContext);
  if (!value) {
    throw new Error("usePlayerSettings must be used inside <PlayerSettingsProvider>");
  }
  return value;
}

/**
 * App-wide playback preferences: sound, speed and auto scroll.
 *
 * None of these is a property of a video, they are properties of the viewer:
 * muting one video mutes the next one you scroll to, and every choice survives
 * a reload. Modelling them per-component meant the feed and `/video/[id]` each
 * kept their own copy, so opening a video from the grid silently reset the
 * sound and stepping to the next one reset the speed back to 1×.
 *
 * The state lives in `localStorage` — an external store — rather than in React,
 * so it is read through `useSyncExternalStore`. That is what keeps the server
 * render (which has no `localStorage`) from disagreeing with the browser:
 * `getServerSnapshot` supplies the defaults for the SSR and hydration passes,
 * and React re-renders with the stored preference immediately afterwards.
 */
export function PlayerSettingsProvider({ children }: { children: React.ReactNode }) {
  const settings = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const toggleMuted = useCallback(() => {
    write({ ...getSnapshot(), muted: !getSnapshot().muted });
  }, []);

  const mute = useCallback(() => {
    const current = getSnapshot();
    if (current.muted) return;
    // Deliberately not persisted: this is the browser refusing unmuted
    // autoplay, not the viewer asking for silence. Writing it through stored
    // "muted: true" on every cold load and permanently overwrote the choice —
    // which is why sound always came back off while speed survived.
    write({ ...current, muted: true }, false);
    restoreSoundOnGesture();
  }, []);

  const changeVolume = useCallback((volume: number) => {
    const next = clampVolume(volume);
    write({ ...getSnapshot(), volume: next, muted: next === 0 });
  }, []);

  const setSpeed = useCallback((speed: number) => {
    write({ ...getSnapshot(), speed: normaliseSpeed(speed) });
  }, []);

  const setAutoScroll = useCallback((on: boolean) => {
    write({ ...getSnapshot(), autoScroll: on });
  }, []);

  const value = useMemo<PlayerSettingsValue>(
    () => ({ ...settings, toggleMuted, mute, changeVolume, setSpeed, setAutoScroll }),
    [settings, toggleMuted, mute, changeVolume, setSpeed, setAutoScroll],
  );

  return (
    <PlayerSettingsContext.Provider value={value}>
      {children}
    </PlayerSettingsContext.Provider>
  );
}

/* ---------------------------------------------------------------- the store */

/*
 * Cached because `getSnapshot` must return a referentially stable value for as
 * long as nothing has changed — parsing storage on every call would hand React
 * a new object each render and loop forever.
 */
let snapshot: PlayerSettings = DEFAULTS;
let loaded = false;

const listeners = new Set<() => void>();

function getSnapshot(): PlayerSettings {
  if (!loaded) {
    snapshot = readSettings() ?? DEFAULTS;
    loaded = true;
  }
  return snapshot;
}

/** No storage on the server, so every SSR render sees the defaults. */
function getServerSnapshot(): PlayerSettings {
  return DEFAULTS;
}

function subscribe(onChange: () => void) {
  listeners.add(onChange);

  // Another tab is a separate React tree; its writes only arrive as this event.
  const sync = (event: StorageEvent) => {
    if (event.key !== null && event.key !== STORAGE_KEY) return;
    snapshot = readSettings() ?? DEFAULTS;
    loaded = true;
    listeners.forEach((listener) => listener());
  };
  window.addEventListener("storage", sync);

  return () => {
    listeners.delete(onChange);
    window.removeEventListener("storage", sync);
  };
}

/**
 * @param persist false for state this tab is forced into, which every other tab
 *   and the next load must not inherit.
 */
function write(next: PlayerSettings, persist = true) {
  snapshot = next;
  loaded = true;
  if (persist) {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // Private mode or a full quota — the preference just stops persisting.
    }
  }
  listeners.forEach((listener) => listener());
}

/** True while a listener is already waiting for the first gesture. */
let awaitingGesture = false;

/**
 * Puts the sound back on as soon as the viewer touches the page.
 *
 * The autoplay policy only refuses *before* the first interaction, so the mute
 * it forces has no reason to outlive that moment. Without this the stored
 * preference survived the reload but never took effect: sound came back muted
 * every single time and had to be switched on by hand, which is the bug as the
 * viewer experiences it.
 *
 * The preference is re-read at that point rather than captured now — muting by
 * hand in between is a real choice and must win.
 */
function restoreSoundOnGesture() {
  if (awaitingGesture) return;
  awaitingGesture = true;

  const events = ["pointerdown", "keydown", "wheel", "touchstart"] as const;
  const restore = () => {
    events.forEach((event) => window.removeEventListener(event, restore));
    awaitingGesture = false;

    const stored = readSettings();
    if (!stored || stored.muted) return;
    write({ ...getSnapshot(), muted: false, volume: stored.volume }, false);
  };

  events.forEach((event) =>
    window.addEventListener(event, restore, { once: true, passive: true }),
  );
}

function clampVolume(volume: number) {
  if (!Number.isFinite(volume)) return DEFAULTS.volume;
  return Math.min(1, Math.max(0, volume));
}

/** Anything off the menu's list is not a rate this app can render — drop it. */
function normaliseSpeed(speed: number) {
  return SPEEDS.includes(speed as (typeof SPEEDS)[number]) ? speed : DEFAULTS.speed;
}

/**
 * Reads the stored preference, or `null` when there is nothing usable there.
 * Every field is re-validated: the value is user-writable, and a `volume`
 * outside 0–1 would throw out of `video.volume`.
 */
function readSettings(): PlayerSettings | null {
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
  if (!raw) return null;

  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return null;

    const { muted, volume, speed, autoScroll } = parsed as Partial<PlayerSettings>;
    return {
      muted: typeof muted === "boolean" ? muted : DEFAULTS.muted,
      volume: typeof volume === "number" ? clampVolume(volume) : DEFAULTS.volume,
      speed: typeof speed === "number" ? normaliseSpeed(speed) : DEFAULTS.speed,
      autoScroll: typeof autoScroll === "boolean" ? autoScroll : DEFAULTS.autoScroll,
    };
  } catch {
    return null;
  }
}

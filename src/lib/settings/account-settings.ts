import type { SettingsAudience } from "@/lib/api/types";

/** The `/setting` value text for each audience, and the picker's labels. */
export const AUDIENCE_LABELS: Record<SettingsAudience, string> = {
  EVERYONE: "Everyone",
  FRIENDS: "Friends",
  NO_ONE: "No one",
};

/** The daily limits the picker offers, in minutes — the app's own presets. */
export const SCREEN_TIME_PRESETS: readonly number[] = [40, 60, 90, 120];

export function formatScreenTimeLimit(minutes: number | null): string {
  return minutes === null ? "Off" : `${minutes} min`;
}

/**
 * The picker's choices, `null` (off) first. A limit saved from another client
 * that is not one of the presets is slotted in by size, so the viewer's current
 * choice always has a radio to be checked on.
 */
export function screenTimeChoices(current: number | null): (number | null)[] {
  const minutes =
    current === null || SCREEN_TIME_PRESETS.includes(current)
      ? SCREEN_TIME_PRESETS
      : [...SCREEN_TIME_PRESETS, current].sort((a, b) => a - b);
  return [null, ...minutes];
}

/** Either end missing is off — the server never stores just one. */
export function formatSleepHours(start: string | null, end: string | null): string {
  return start && end ? `${start} – ${end}` : "Off";
}

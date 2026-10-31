import type { SettingsAudience, UserSettingsResponse } from "@/lib/api/types";

/** The `/setting` value text for each audience, and the picker's labels. */
export const AUDIENCE_LABELS: Record<SettingsAudience, string> = {
  EVERYONE: "Everyone",
  FRIENDS: "Friends",
  NO_ONE: "No one",
};

/** The daily limit chips, in minutes — the app's own presets. */
export const DAILY_LIMIT_PRESETS: readonly number[] = [40, 60, 90, 120];

/** A limit as the live chips print it: "40m", "1h", "1h 30m". */
export function formatLimit(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) return `${rest}m`;
  return rest === 0 ? `${hours}h` : `${hours}h ${rest}m`;
}

/** Today's limit in minutes, or null when there is none. Per-day limits run Monday first. */
export function todayLimitMinutes(settings: UserSettingsResponse, now: Date): number | null {
  const byDay = settings.screenTimeLimitsByDay;
  if (byDay) return byDay[(now.getDay() + 6) % 7] ?? null;
  return settings.screenTimeLimitMinutes;
}

/** The Daily screen time row's value: "Off", or today's limit. */
export function dailyLimitValue(settings: UserSettingsResponse | null, now: Date): string {
  const minutes = settings && todayLimitMinutes(settings, now);
  return minutes ? formatLimit(minutes) : "Off";
}

/** The Sleep hours row's value. The end is always the start plus eight hours. */
export function formatSleepHours(start: string | null): "On" | "Off" {
  return start ? "On" : "Off";
}

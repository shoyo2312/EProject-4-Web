/** Sleep hours last this long from their start, as on TikTok: the end is never chosen. */
export const SLEEP_HOURS_LENGTH_MINUTES = 8 * 60;

/** How long "Return for now" keeps the sleep screen away, as on TikTok. */
export const SLEEP_SNOOZE_MS = 60 * 60 * 1000;

const DAY_MINUTES = 24 * 60;

/**
 * Whether `now` is inside the window that opens at `start` ("HH:mm" on the
 * viewer's own wall clock) and runs eight hours, across midnight when it
 * starts late.
 */
export function inSleepHours(start: string | null, now: Date): boolean {
  if (!start) return false;
  const [hours, minutes] = start.split(":").map(Number);
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const sinceStart = (nowMinutes - (hours * 60 + minutes) + DAY_MINUTES) % DAY_MINUTES;
  return sinceStart < SLEEP_HOURS_LENGTH_MINUTES;
}

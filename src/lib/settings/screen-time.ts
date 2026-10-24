/**
 * Screen time → Summary: the weeks it offers, the chart's axis and the way it
 * writes a duration. Measured off the live chart; see
 * `docs/research/tiktok.com/SETTINGS.md`.
 */

const pad = (n: number) => String(n).padStart(2, "0");

const isoDate = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

const shortDate = (d: Date) =>
  d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

function mondayOf(d: Date): Date {
  const sinceMonday = (d.getDay() + 6) % 7;
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() - sinceMonday);
}

/** The local Monday of `d`'s week, "YYYY-MM-DD": the key the week read takes. */
export function weekStartOf(d: Date): string {
  return isoDate(mondayOf(d));
}

/**
 * The weeks "Select week" offers: the last four, oldest first and the current
 * one last, as on the live page. Labelled "Oct 19, 2026-Oct 25, 2026".
 */
export function lastFourWeeks(today: Date): { start: string; label: string }[] {
  const monday = mondayOf(today);
  return [21, 14, 7, 0].map((daysBack) => {
    const start = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() - daysBack);
    const end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 6);
    return { start: isoDate(start), label: `${shortDate(start)}-${shortDate(end)}` };
  });
}

/** About this many gridlines, as the live chart draws. */
const TICK_COUNT = 6;

/** A round step of 1, 2 or 5 × 10^k seconds near `raw` — the live chart's steps. */
function niceStep(raw: number): number {
  const power = 10 ** Math.floor(Math.log10(raw));
  const error = raw / power;
  if (error >= Math.sqrt(50)) return power * 10;
  if (error >= Math.sqrt(10)) return power * 5;
  if (error >= Math.sqrt(2)) return power * 2;
  return power;
}

/** The value of the chart's top gridline, in seconds: a round step at or above `maxSeconds`. */
export function axisTop(maxSeconds: number): number {
  if (maxSeconds <= 0) return 0;
  const step = niceStep(maxSeconds / TICK_COUNT);
  return Math.ceil(maxSeconds / step) * step;
}

/**
 * The gridlines above the baseline, top first, in minutes to one decimal.
 * `maxSeconds` is the week's longest day. A week with no time at all still
 * draws its six lines, every one at 0, as the live chart does.
 */
export function axisTicks(maxSeconds: number): number[] {
  if (maxSeconds <= 0) return Array<number>(TICK_COUNT).fill(0);
  const step = niceStep(maxSeconds / TICK_COUNT);
  const lines = Math.ceil(maxSeconds / step);
  return Array.from({ length: lines }, (_, i) => Math.round(((lines - i) * step) / 6) / 10);
}

/** "1h 5m", "12m", "0m": whole minutes, rounded, as the live legend writes them. */
export function formatDuration(seconds: number): string {
  const minutes = Math.round(seconds / 60);
  const hours = Math.floor(minutes / 60);
  return hours > 0 ? `${hours}h ${minutes % 60}m` : `${minutes}m`;
}

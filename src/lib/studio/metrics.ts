/** Studio's number formatting and chart geometry. No data, no React. */

/** The windows Studio's picker offers, as TikTok labels them. */
export const RANGE_OPTIONS = [7, 28, 60, 365] as const;
export type RangeDays = (typeof RANGE_OPTIONS)[number];

export function rangeLabel(days: number): string {
  return `Last ${days} days`;
}

/**
 * The line under a metric: the change and the change in percent, the way TikTok
 * writes it — "+40 (+50.0%)". With nothing before to compare against the
 * percent is "--", as on TikTok, rather than an infinity.
 */
export function changeLine(current: number, previous: number): string {
  const delta = current - previous;
  const percent = previous === 0 ? "--" : `${signed((delta / Math.abs(previous)) * 100, 1)}%`;
  return `${signed(delta, 0)} (${percent})`;
}

function signed(value: number, digits: number): string {
  const text = Math.abs(value).toFixed(digits);
  if (Number(text) === 0) return digits === 0 ? "0" : `${text}`;
  return `${value > 0 ? "+" : "-"}${text}`;
}

/** The top of a chart's axis: the next 1, 2 or 5 times a power of ten at or above `max`. */
export function niceMax(max: number): number {
  if (max <= 0) return 1;
  const power = 10 ** Math.floor(Math.log10(max));
  const step = [1, 2, 5, 10].find((m) => m * power >= max) ?? 10;
  return step * power;
}

/**
 * An SVG path through `values`, spread evenly over `width`, 0 at the bottom and
 * `max` at the top. One value draws a flat line across, so a one-day window
 * still shows something.
 */
export function linePath(values: number[], width: number, height: number, max: number): string {
  if (values.length === 0) return "";
  const top = max > 0 ? max : 1;
  const y = (value: number) => round(height - (Math.max(0, value) / top) * height);
  if (values.length === 1) return `M0 ${y(values[0])} L${width} ${y(values[0])}`;
  const step = width / (values.length - 1);
  return values.map((value, i) => `${i === 0 ? "M" : "L"}${round(i * step)} ${y(value)}`).join(" ");
}

function round(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Which of `count` points get a label under the chart: both ends, and the rest
 * evenly between, never more than `max`. Seven labels for a week, still seven
 * for a year.
 */
export function labelIndexes(count: number, max = 7): number[] {
  if (count <= 0) return [];
  if (count <= max) return Array.from({ length: count }, (_, i) => i);
  const step = (count - 1) / (max - 1);
  return Array.from({ length: max }, (_, i) => Math.round(i * step));
}

/** A `YYYY-MM-DD` day from analytics as "Oct 17". Parsed as a date, never through a time zone. */
export function dayLabel(day: string): string {
  const [year, month, date] = day.split("-").map(Number);
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" }).format(
    new Date(Date.UTC(year, month - 1, date)),
  );
}

/** Watch time as "5.4s", "1m 5s" or "2h 3m". */
export function formatWatchTime(ms: number): string {
  const seconds = ms / 1000;
  if (seconds < 60) return `${Number(seconds.toFixed(1))}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ${Math.floor(seconds % 60)}s`;
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
}

/** A 0–1 share as "42.5%". */
export function formatPercent(share: number): string {
  return `${Number((share * 100).toFixed(1))}%`;
}

/**
 * A picked span of local calendar days as the inbox's instants: `from` at the
 * first day's midnight, `to` at the midnight after the last, which the server
 * treats as exclusive. Either end may be open.
 */
export function dayRangeToInstants(first: Date | null, last: Date | null): { from?: string; to?: string } {
  const midnight = (day: Date, plusDays: number) =>
    new Date(day.getFullYear(), day.getMonth(), day.getDate() + plusDays).toISOString();
  return {
    from: first ? midnight(first, 0) : undefined,
    to: last ? midnight(last, 1) : undefined,
  };
}

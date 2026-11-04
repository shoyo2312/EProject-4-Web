/**
 * The days of one month laid out as a calendar, Sunday first like TikTok's
 * picker: leading nulls up to the 1st, then every day. No trailing padding —
 * the last row simply ends.
 */
export function monthGrid(year: number, month: number): (Date | null)[] {
  const first = new Date(year, month, 1);
  const length = new Date(year, month + 1, 0).getDate();
  return [
    ...Array.from({ length: first.getDay() }, () => null),
    ...Array.from({ length }, (_, i) => new Date(year, month, i + 1)),
  ];
}

export function sameDay(a: Date | null, b: Date | null): boolean {
  return !!a && !!b && a.toDateString() === b.toDateString();
}

/**
 * A press on `day` with `start`/`end` already picked: the first press starts a
 * range, the second closes it (in either order), a third starts over.
 */
export function pickDay(
  start: Date | null,
  end: Date | null,
  day: Date,
): { start: Date; end: Date | null } {
  if (!start || end) return { start: day, end: null };
  return day < start ? { start: day, end: start } : { start, end: day };
}

/** True strictly between the two picked days, for the pale band behind them. */
export function inRange(day: Date, start: Date | null, end: Date | null): boolean {
  return !!start && !!end && day > start && day < end;
}

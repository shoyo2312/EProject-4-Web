import { MONTHS } from "@/lib/forms/schemas";

/** The sign-up form's three selects as the `YYYY-MM-DD` the API takes. Month is a `MONTHS` name. */
export function toIsoBirthDate(month: string, day: string, year: string): string {
  const monthNumber = MONTHS.indexOf(month as (typeof MONTHS)[number]) + 1;
  return `${year}-${String(monthNumber).padStart(2, "0")}-${String(Number(day)).padStart(2, "0")}`;
}

"use client";

import { apiFetch } from "@/lib/api/client";

/**
 * user-service's screen time: the caller's own time on the site, read off the
 * token like the rest of `/users/me`.
 */

export interface ScreenTimeDay {
  /** "YYYY-MM-DD", the day in the time zone the heartbeats came from. */
  date: string;
  /** 06:00–22:00 local. */
  daySeconds: number;
  /** 22:00–06:00 local. */
  nightSeconds: number;
}

export interface ScreenTimeWeekResponse {
  weekStart: string;
  /** Monday to Sunday, every day present: a day with no time on the site reads 0. */
  days: ScreenTimeDay[];
}

/**
 * `POST /users/me/screen-time/heartbeat` — the seconds spent on the site since
 * the last one, which the server clamps at 120, and the zone they were spent in.
 */
export function sendScreenTimeHeartbeat(seconds: number, timeZone: string): Promise<void> {
  return apiFetch<void>("/users/me/screen-time/heartbeat", {
    method: "POST",
    body: { seconds, timeZone },
    auth: "required",
  });
}

/** `GET /users/me/screen-time?weekStart=` — `weekStart` must be a Monday. */
export function getScreenTimeWeek(weekStart: string): Promise<ScreenTimeWeekResponse> {
  return apiFetch<ScreenTimeWeekResponse>("/users/me/screen-time", {
    query: { weekStart },
    auth: "required",
  });
}

/**
 * `POST /users/me/screen-time/passcode/verify`. Five wrong guesses lock it for
 * 15 minutes: a 429 with code `TOO_MANY_PASSCODE_ATTEMPTS`.
 */
export async function verifyScreenTimePasscode(passcode: string): Promise<boolean> {
  const { correct } = await apiFetch<{ correct: boolean }>(
    "/users/me/screen-time/passcode/verify",
    { method: "POST", body: { passcode }, auth: "required" },
  );
  return correct;
}

/**
 * The two rename limits as the Edit profile modal applies them: a handle once
 * every 30 days (auth-service) and a nickname once every 7 (user-service). The
 * servers enforce both and say when each lifts; the client only asks whether
 * that moment has come.
 */

/**
 * When the field opens again, or null when it is open now — no lock, one that
 * has already lifted, or a value that is not a date. Failing open is safe: the
 * server still refuses a change made too soon.
 */
export function lockedUntil(
  changeableAt: string | null | undefined,
  now: number = Date.now(),
): Date | null {
  if (!changeableAt) return null;
  const at = new Date(changeableAt);
  return at.getTime() > now ? at : null;
}

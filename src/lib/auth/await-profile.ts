import { getMyProfile } from "@/lib/api/users";

/**
 * A new account exists in auth-service the moment sign-up answers, but its
 * profile is built in user-service off a Kafka event a beat later. Until then
 * `/users/me` — and every profile page — answers "not found". Holding the
 * viewer here until it exists keeps a quick tap on "Profile" from landing on
 * "This account is unavailable".
 *
 * Any failure counts as "not yet": the account itself is already made, so
 * running out of attempts lets the sign-in finish rather than strand the
 * viewer on a form that cannot succeed twice.
 * ponytail: fixed interval, no backoff — add one if user-service gets slow
 * enough to make ~10s too short.
 */
export async function awaitProfile(
  fetchProfile: () => Promise<unknown> = getMyProfile,
  { attempts = 20, delayMs = 500 }: { attempts?: number; delayMs?: number } = {},
): Promise<boolean> {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      await fetchProfile();
      return true;
    } catch {
      if (attempt < attempts - 1) {
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }
  }
  return false;
}

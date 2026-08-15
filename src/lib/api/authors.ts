"use client";

import { authorFromProfile, unknownAuthor } from "@/lib/api/adapters";
import { getProfile } from "@/lib/api/users";
import { hasSession } from "@/lib/api/tokens";
import type { Author } from "@/types/tiktok";

/**
 * Video responses identify their author by id and nothing else, so every card
 * needs a second call to user-service to learn a name and an avatar. This
 * memoises those lookups for the life of the tab: a feed page of 20 videos from
 * five creators costs five requests, not twenty, and scrolling back over them
 * costs none.
 *
 * Signed-out viewers get placeholders instead. That is not a shortcut — every
 * user-service endpoint requires a token, including reading a public profile,
 * so there is genuinely nothing to fetch until someone logs in.
 */
const cache = new Map<string, Promise<Author>>();

export function resolveAuthor(userId: string): Promise<Author> {
  if (!hasSession()) return Promise.resolve(unknownAuthor(userId));

  const cached = cache.get(userId);
  if (cached) return cached;

  const pending = getProfile(userId)
    .then(authorFromProfile)
    .catch(() => {
      // 404 here means "unavailable", which covers both "no such account" and
      // "one of you blocked the other" — the server refuses to say which, so
      // the card shows a neutral placeholder rather than guessing.
      cache.delete(userId);
      return unknownAuthor(userId);
    });

  cache.set(userId, pending);
  return pending;
}

/** Resolves a batch of ids, de-duplicated, into an id → author map. */
export async function resolveAuthors(
  userIds: string[],
): Promise<Map<string, Author>> {
  const unique = [...new Set(userIds)];
  const authors = await Promise.all(unique.map(resolveAuthor));

  return new Map(unique.map((userId, index) => [userId, authors[index]]));
}

/** Called on sign-in/sign-out: the placeholders must not outlive the session. */
export function clearAuthorCache(): void {
  cache.clear();
}

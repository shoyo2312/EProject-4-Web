"use client";

import { useEffect, useMemo, useState } from "react";

import { authorFromProfile } from "@/lib/api/adapters";
import type { SuggestedAccountResponse } from "@/lib/api/types";
import { getSuggestedAccounts, setFollowState } from "@/lib/api/users";
import { reasonLabel, SUGGESTED_ACCOUNTS_LIMIT } from "@/lib/suggested-accounts";
import type { SuggestedAccount } from "@/types/tiktok";

export interface SuggestedAccountsState {
  accounts: SuggestedAccount[];
  isLoading: boolean;
  error: unknown;
}

/**
 * "People you may know" for the viewer. Fetched once per mount, the first time
 * `enabled` turns true, and kept for the life of the page: most profile views
 * never open the row, and toggling it must not ask again.
 *
 * `excludeUserId` is the profile being viewed. The endpoint is viewer-only by
 * design, so one more than the limit is asked for and the owner dropped here.
 */
export function useSuggestedAccounts(
  enabled: boolean,
  excludeUserId?: string,
): SuggestedAccountsState {
  const [started, setStarted] = useState(false);
  const [items, setItems] = useState<SuggestedAccountResponse[] | null>(null);
  const [error, setError] = useState<unknown>(null);

  if (enabled && !started) setStarted(true);

  useEffect(() => {
    if (!started) return;
    const controller = new AbortController();

    getSuggestedAccounts(SUGGESTED_ACCOUNTS_LIMIT + 1, controller.signal)
      .then((result) => {
        if (controller.signal.aborted) return;
        // The server just said the viewer follows none of them; without this
        // every card's follow button would walk the following list to find out.
        for (const item of result) setFollowState(item.profile.userId, false);
        setItems(result);
        setError(null);
      })
      .catch((cause) => {
        if (controller.signal.aborted) return;
        setItems([]);
        setError(cause);
      });

    return () => controller.abort();
  }, [started]);

  const accounts = useMemo(
    () =>
      (items ?? [])
        .filter((item) => item.profile.userId !== excludeUserId)
        .slice(0, SUGGESTED_ACCOUNTS_LIMIT)
        .map((item) => ({
          author: authorFromProfile(item.profile),
          label: reasonLabel(item.reason, item.followedBy),
        })),
    [items, excludeUserId],
  );

  return { accounts, isLoading: started && items === null, error };
}

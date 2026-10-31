"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { useSession } from "@/components/session/SessionProvider";
import { isLastPage } from "@/lib/api/types";
import type { UserProfileResponse } from "@/lib/api/types";
import { getFollowing } from "@/lib/api/users";

const PAGE_SIZE = 20;

export interface FollowingAccountsState {
  accounts: UserProfileResponse[];
  /** Fetches the next page; absent once there is none. */
  loadMore?: () => void;
}

/**
 * The viewer's own following list, for the sidebar: its first rows under the
 * nav, and all of it, a page at a time, in the drawer behind View all. One list
 * for both readers, as with the inbox, so the drawer opens on rows already
 * loaded rather than fetching page 0 again.
 */
export function useFollowingAccounts(): FollowingAccountsState {
  const { user } = useSession();
  const viewerId = user?.userId ?? null;
  // Keyed by viewer, so a sign-out or an account switch drops the old rows
  // without a synchronous reset at the top of the effect.
  const [list, setList] = useState<{
    viewerId: string;
    accounts: UserProfileResponse[];
    hasMore: boolean;
  } | null>(null);
  const next = useRef<number | null>(null);
  const busy = useRef(false);
  /** Bumped per viewer, so a page still in flight for the last one is dropped. */
  const epoch = useRef(0);

  const fetchPage = useCallback(async (viewer: string, page: number, started: number) => {
    const result = await getFollowing(viewer, page, PAGE_SIZE);
    if (started !== epoch.current) return;
    const hasMore = !isLastPage(result.page);
    next.current = hasMore ? page + 1 : null;
    setList((current) => {
      const shown = page > 0 && current?.viewerId === viewer ? current.accounts : [];
      // Offset paging over a list the viewer may be growing in another tab
      // repeats the row a new follow pushed across the page boundary.
      const seen = new Set(shown.map((account) => account.userId));
      return {
        viewerId: viewer,
        accounts: [...shown, ...result.content.filter((account) => !seen.has(account.userId))],
        hasMore,
      };
    });
  }, []);

  useEffect(() => {
    epoch.current += 1;
    next.current = null;
    if (!viewerId) return;
    // A failed first page leaves the section off the sidebar; it is decoration,
    // and the next sign-in or reload asks again.
    fetchPage(viewerId, 0, epoch.current).catch(() => {});
  }, [viewerId, fetchPage]);

  const loadMore = useCallback(async () => {
    const page = next.current;
    if (!viewerId || page === null || busy.current) return;
    busy.current = true;
    try {
      await fetchPage(viewerId, page, epoch.current);
    } catch {
      // Left as it was: the drawer's sentinel retries on the next scroll.
    } finally {
      busy.current = false;
    }
  }, [viewerId, fetchPage]);

  const current = list?.viewerId === viewerId ? list : null;
  return {
    accounts: current?.accounts ?? [],
    loadMore: current?.hasMore ? loadMore : undefined,
  };
}

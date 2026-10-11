"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { CloseIcon } from "@/components/icons";
import { Modal } from "@/components/ui/modal";
import { toast } from "@/components/ui/toast";
import { authorFromProfile, displayHandle } from "@/lib/api/adapters";
import { isApiError, messageFor } from "@/lib/api/errors";
import type { UserProfileResponse } from "@/lib/api/types";
import {
  approveFollowRequest,
  declineFollowRequest,
  getFollowRequests,
} from "@/lib/api/users";

// ponytail: the 50 newest requests. Page through `getFollowRequests` here if a
// private account ever has more than that waiting.
const REQUEST_LIMIT = 50;

/**
 * A private account's follow requests, newest first, each with Confirm and
 * Delete. Opened from the top of the Activity panel, which re-counts through
 * `onSettled` whenever one is answered.
 */
export function FollowRequestsModal({
  onClose,
  onLeave,
  onSettled,
}: {
  onClose: () => void;
  /** A requester's profile is opening: close this and the panel under it. */
  onLeave: () => void;
  onSettled: () => void;
}) {
  const [requests, setRequests] = useState<UserProfileResponse[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    getFollowRequests(0, REQUEST_LIMIT).then(
      (page) => {
        if (!cancelled) setRequests(page.content);
      },
      (cause) => {
        if (cancelled) return;
        toast.error(messageFor(cause));
        setRequests([]);
      },
    );
    return () => {
      cancelled = true;
    };
  }, []);

  /** Off the list at once; back on it, with the error, if the call fails. */
  const settle = (requester: UserProfileResponse, approve: boolean) => {
    setRequests((current) => current?.filter((row) => row.userId !== requester.userId) ?? null);
    const call: Promise<unknown> = approve
      ? approveFollowRequest(requester.userId)
      : declineFollowRequest(requester.userId);
    call.then(onSettled, (cause: unknown) => {
      // Answered already — in another tab, or by switching the account to
      // public, which approves everyone waiting. The row was right to go.
      if (isApiError(cause) && cause.is("FOLLOW_REQUEST_NOT_FOUND")) {
        onSettled();
        return;
      }
      toast.error(messageFor(cause));
      setRequests((current) => current && [requester, ...current]);
    });
  };

  return (
    <Modal
      onClose={onClose}
      className="flex max-h-[min(560px,80vh)] w-[420px] flex-col rounded-[12px] py-4"
    >
      <div className="relative px-12 pb-3">
        <h2 className="text-center text-[18px] font-bold leading-6 text-[var(--tt-text)]">
          Follow requests
        </h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute end-4 top-0 flex h-7 w-7 items-center justify-center rounded-full bg-[var(--tt-field)] text-[var(--tt-icon)] transition-colors hover:bg-[var(--tt-shape-neutral-3)]"
        >
          <CloseIcon className="h-3.5 w-3.5" />
        </button>
      </div>

      <ul className="min-h-0 flex-1 overflow-y-auto">
        {requests === null && (
          <li className="px-6 py-8 text-center text-[15px] text-[var(--tt-text-muted)]">
            Loading…
          </li>
        )}
        {requests?.length === 0 && (
          <li className="px-6 py-8 text-center text-[15px] text-[var(--tt-text-muted)]">
            No one is waiting for your approval.
          </li>
        )}
        {requests?.map((requester) => {
          const author = authorFromProfile(requester);
          const handle = displayHandle(author);
          return (
            <li key={requester.userId} className="flex items-center gap-3 px-4 py-2">
              <Link
                href={`/@${requester.userId}`}
                onClick={onLeave}
                className="flex min-w-0 flex-1 items-center gap-3"
              >
                {/* eslint-disable-next-line @next/next/no-img-element -- the avatar can be any CDN URL */}
                <img
                  src={author.avatarUrl}
                  alt=""
                  className="h-11 w-11 flex-none rounded-full object-cover"
                />
                <span className="min-w-0">
                  <span className="block truncate text-[15px] font-semibold text-[var(--tt-text)]">
                    {author.nickname}
                  </span>
                  {handle && (
                    <span className="block truncate text-[14px] text-[var(--tt-text-secondary)]">
                      @{handle}
                    </span>
                  )}
                </span>
              </Link>
              <button
                type="button"
                onClick={() => settle(requester, true)}
                className="h-8 flex-none rounded-[4px] bg-[var(--tt-red-active)] px-4 text-[14px] font-semibold text-white transition-colors hover:bg-[var(--tt-red)]"
              >
                Confirm
              </button>
              <button
                type="button"
                onClick={() => settle(requester, false)}
                className="h-8 flex-none rounded-[4px] bg-[var(--tt-field)] px-4 text-[14px] font-semibold text-[var(--tt-text)] transition-colors hover:bg-[var(--tt-shape-neutral-3)]"
              >
                Delete
              </button>
            </li>
          );
        })}
      </ul>
    </Modal>
  );
}

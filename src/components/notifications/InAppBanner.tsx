"use client";

import { useEffect, useState } from "react";

import { toast } from "@/components/ui/toast";
import type { NotificationFrame } from "@/hooks/use-notification-realtime";
import { DEFAULT_AVATAR } from "@/lib/api/adapters";
import { getProfile } from "@/lib/api/users";

/**
 * A banner for a notification that lands while the viewer is on the site: the
 * in-app counterpart of a push, which the In-app notifications switches gate.
 * Top-right, under the inbox it belongs to, for five seconds. A click opens the
 * inbox. Keyed by the notification, so a relayed copy replaces it rather than
 * stacking a second one.
 */
export function showInAppBanner(frame: NotificationFrame, onOpen?: () => void): void {
  toast.custom(
    (id) => (
      <InAppBanner
        frame={frame}
        onOpen={() => {
          onOpen?.();
          toast.dismiss(id);
        }}
      />
    ),
    { id: frame.notificationId, position: "top-right", duration: 5000 },
  );
}

/** Laid out like a row of the Activity drawer it opens: avatar, title, body. */
function InAppBanner({ frame, onOpen }: { frame: NotificationFrame; onOpen: () => void }) {
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!frame.actorId) return;
    let cancelled = false;
    getProfile(frame.actorId).then(
      (profile) => {
        if (!cancelled) setAvatarUrl(profile.avatarUrl);
      },
      () => {
        // Gone or blocked: the default avatar stays.
      },
    );
    return () => {
      cancelled = true;
    };
  }, [frame.actorId]);

  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex w-[356px] items-center gap-3 rounded-[8px] bg-[rgb(37,37,37)] p-3 text-start shadow-[0_4px_16px_rgb(0_0_0/0.4)] transition-colors hover:bg-[rgb(47,47,47)]"
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- the avatar can be any CDN URL the account set; next/image would need each host allow-listed */}
      <img
        src={avatarUrl ?? DEFAULT_AVATAR}
        alt=""
        referrerPolicy="no-referrer"
        width={48}
        height={48}
        className="h-12 w-12 flex-none rounded-full object-cover"
      />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[14px] leading-[18px] font-semibold text-[var(--tt-text)]">
          {frame.title}
        </span>
        <span className="mt-0.5 line-clamp-2 text-[13px] leading-[17px] text-[rgb(255_255_255_/_0.5)]">
          {frame.body}
        </span>
      </span>
    </button>
  );
}

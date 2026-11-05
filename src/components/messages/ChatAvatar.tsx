"use client";

import { useState } from "react";

import { DEFAULT_AVATAR } from "@/lib/api/adapters";
import { cn } from "@/lib/utils";

/**
 * A round avatar that always draws something: the account's picture, then the default one if that
 * fails to load, then a plain tinted circle if even that is missing. Remote avatars can be any CDN
 * URL the account set, so a broken image is routine rather than exceptional.
 */
export function ChatAvatar({
  src,
  className,
}: {
  src: string | undefined;
  className?: string;
}) {
  const [failed, setFailed] = useState<readonly string[]>([]);
  const shown = [src ?? DEFAULT_AVATAR, DEFAULT_AVATAR].find((candidate) => !failed.includes(candidate));
  const base = "flex-none rounded-full bg-[var(--tt-field)]";

  if (!shown) return <span aria-hidden className={cn(base, className)} />;

  return (
    // eslint-disable-next-line @next/next/no-img-element -- the avatar can be any CDN URL the account set; next/image would need each host allow-listed
    <img
      src={shown}
      alt=""
      referrerPolicy="no-referrer"
      onError={() => setFailed((current) => [...current, shown])}
      className={cn(base, "object-cover", className)}
    />
  );
}

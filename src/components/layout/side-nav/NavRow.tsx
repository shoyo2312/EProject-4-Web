"use client";

import Link from "next/link";
import type { ComponentType, SVGProps } from "react";

import {
  ActivityIcon,
  ExploreIcon,
  ForYouIcon,
  FollowingIcon,
  FriendsIcon,
  MessagesIcon,
  MoreIcon,
  UploadIcon,
} from "@/components/icons";
import { Tooltip } from "@/components/ui/Tooltip";
import { cn } from "@/lib/utils";
import type { NavItem } from "@/types/tiktok";

const ICONS: Record<string, ComponentType<SVGProps<SVGSVGElement>>> = {
  "For You": ForYouIcon,
  Explore: ExploreIcon,
  Following: FollowingIcon,
  Friends: FriendsIcon,
  Messages: MessagesIcon,
  Activity: ActivityIcon,
  Upload: UploadIcon,
  More: MoreIcon,
};

/**
 * Nav row = TUX secondary button, 208×40, radius 6px, transparent background,
 * `.TUXButton-content` 204×32 with gap 12px, `.TUXButton-iconContainer` 32×32,
 * label 16px/500/21px. Active label colour #FF3B5C, inactive icon #F6F6F6.
 */
export function NavRow({
  item,
  avatarUrl,
  collapsed = false,
  iconOnly = false,
  active = false,
  selected = false,
  onClick,
}: {
  item: NavItem;
  /** The viewer's avatar, which the Profile row renders in place of an icon. */
  avatarUrl: string;
  /** True while the sidebar is held at 4.5rem — by an open drawer, or by the
   *  reader's collapse toggle. */
  collapsed?: boolean;
  /** True whenever the label is off screen — a drawer is open *or* the rail is
   *  below its 1024px breakpoint. Gates the hover tip that stands in for the label. */
  iconOnly?: boolean;
  /** The row whose href matches the current route. */
  active?: boolean;
  selected?: boolean;
  onClick?: () => void;
}) {
  const Icon = ICONS[item.label];

  const inner = (
    <span
      className={cn(
        "group inline-flex h-10 items-center rounded-[6px]",
        // 40px wide, not 208: the live rows shrink to their icon box while the
        // column keeps its 208px width, so `items-center` parks them entirely
        // outside the 4.5rem rail (x = -68 … -28) instead of leaving the labels
        // half visible next to the panel.
        collapsed ? "w-10" : "w-full tt-1024:w-10",
        "transition-colors hover:bg-[var(--tt-field)]",
        selected && "bg-[var(--tt-field)]",
      )}
    >
      <span
        className={cn(
          "flex h-8 items-center gap-3",
          collapsed ? "w-10 justify-center" : "w-full tt-1024:w-10 tt-1024:justify-center",
        )}
      >
        <span className="relative flex h-8 w-8 flex-none items-center justify-center">
          {item.label === "Profile" ? (
            // eslint-disable-next-line @next/next/no-img-element -- the avatar can be any CDN URL the account set; next/image would need each host allow-listed
            <img
              src={avatarUrl}
              alt=""
              width={32}
              height={32}
              className="h-8 w-8 rounded-full object-cover"
            />
          ) : Icon ? (
            <Icon
              className={cn(
                "h-[26px] w-[26px]",
                active ? "text-[var(--tt-red-active)]" : "text-[var(--tt-icon)]",
              )}
            />
          ) : null}

          {item.badgeCount ? (
            <span className="absolute -right-1 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-[var(--tt-red)] px-1 text-[10px] font-bold leading-none text-white">
              {item.badgeCount}
            </span>
          ) : null}
        </span>

        <span
          className={cn(
            "truncate text-[16px] font-medium leading-[21px]",
            collapsed ? "hidden" : "tt-1024:hidden",
            active ? "text-[var(--tt-red-active)]" : "text-[var(--tt-text)]",
          )}
        >
          {item.label}
        </span>
      </span>
    </span>
  );

  const row =
    item.kind === "link" && item.href ? (
      <Link
        href={item.href}
        aria-label={iconOnly ? item.label : undefined}
        className={cn(collapsed ? "w-10" : "w-full")}
      >
        {inner}
      </Link>
    ) : (
      <button
        type="button"
        onClick={onClick}
        aria-label={iconOnly ? item.label : undefined}
        aria-expanded={onClick ? selected : undefined}
        className={cn("text-left", collapsed ? "w-10" : "w-full")}
      >
        {inner}
      </button>
    );

  return iconOnly ? (
    <Tooltip label={item.label} placement="right">
      {row}
    </Tooltip>
  ) : (
    row
  );
}

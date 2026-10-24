"use client";

import { useState } from "react";

import { TriangleDownIcon } from "@/components/icons";
import { useSession } from "@/components/session/SessionProvider";
import { RowBody, Switch } from "@/components/settings/rows/parts";
import { toast } from "@/components/ui/toast";
import type { AccountSettings } from "@/hooks/use-account-settings";
import { messageFor } from "@/lib/api/errors";
import type { NotificationSwitch } from "@/lib/settings/notification-preferences";
import type { SettingsRow } from "@/types/tiktok";

/**
 * Push notifications → Interactions / In-app notifications: a row that opens in
 * place onto one switch per kind of notification. The page keeps one of them
 * open at a time, as the live panel does, and its caret points down either way.
 * Measured in `docs/research/tiktok.com/SETTINGS.md`.
 */
export function PreferenceExpandRow({
  row,
  account,
  expanded,
  onToggle,
  switches,
}: {
  row: SettingsRow;
  account: AccountSettings;
  expanded: boolean;
  onToggle: () => void;
  switches: NotificationSwitch[];
}) {
  const heading = row.kind === "expand" && row.heading;

  return (
    <div className="border-b border-[var(--tt-divider)] last:border-b-0">
      <button
        type="button"
        aria-expanded={expanded}
        onClick={onToggle}
        className="flex w-full items-center gap-4 px-4 py-3 text-left hover:bg-white/[0.03]"
      >
        {heading ? (
          <span className="min-w-0 flex-1 text-[18px] leading-6 font-semibold text-[var(--tt-text)]">
            {row.title}
          </span>
        ) : (
          <RowBody row={row} />
        )}
        <TriangleDownIcon className="h-5 w-5 flex-none text-[rgb(255_255_255/0.6)]" />
      </button>

      {expanded &&
        switches.map((item) => (
          <PreferenceSwitch key={item.field} item={item} account={account} />
        ))}
    </div>
  );
}

function PreferenceSwitch({
  item,
  account,
}: {
  item: NotificationSwitch;
  account: AccountSettings;
}) {
  const { requireSignIn } = useSession();
  /** Where the switch is headed while its save is in flight. */
  const [target, setTarget] = useState<boolean | null>(null);
  // Every switch defaults on, so until the account's answer is in this shows
  // what the server would say.
  const on = target ?? account.settings?.[item.field] ?? true;

  const onToggle = () => {
    if (!requireSignIn() || !account.settings || target !== null) return;
    setTarget(!on);
    account
      .update({ [item.field]: !on })
      .catch((cause) => toast.error(messageFor(cause)))
      .finally(() => setTarget(null));
  };

  return (
    <div className="flex h-[54px] items-center justify-between gap-4 px-4">
      <span className="text-[16px] leading-[22px] text-[var(--tt-text)]">{item.label}</span>
      <Switch on={on} label={item.label} onToggle={onToggle} />
    </div>
  );
}

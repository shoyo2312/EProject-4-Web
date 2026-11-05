"use client";

import { useState } from "react";

import { useSession } from "@/components/session/SessionProvider";
import { ExpandRow, Switch } from "@/components/settings/rows/parts";
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
  return (
    <ExpandRow row={row} expanded={expanded} onToggle={onToggle}>
      {switches.map((item) => (
        <PreferenceSwitch key={item.field} item={item} account={account} />
      ))}
    </ExpandRow>
  );
}

function PreferenceSwitch({
  item,
  account,
}: {
  item: NotificationSwitch;
  account: AccountSettings;
}) {
  const { isSignedIn, requireSignIn } = useSession();
  /** Where the switch is headed while its save is in flight. */
  const [target, setTarget] = useState<boolean | null>(null);
  // Every switch defaults on, so until the account's answer is in this shows
  // what the server would say — dimmed, since the account may have said otherwise.
  const on = target ?? account.settings?.[item.field] ?? true;
  const loading = isSignedIn && !account.settings;

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
      <Switch on={on} label={item.label} onToggle={onToggle} disabled={loading} />
    </div>
  );
}

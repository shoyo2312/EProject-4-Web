"use client";

import { useEffect, useState, type ReactNode } from "react";

import { TimeClockIcon } from "@/components/icons";
import { DialogRowButton } from "@/components/settings/rows/AccountRows";
import { Switch } from "@/components/settings/rows/parts";
import {
  PickerField,
  type PickerColumn,
} from "@/components/settings/rows/screen-time/PickerField";
import { toast } from "@/components/ui/toast";
import type { AccountSettings } from "@/hooks/use-account-settings";
import { messageFor } from "@/lib/api/errors";
import type { UserSettingsResponse } from "@/lib/api/types";
import { formatSleepHours } from "@/lib/settings/account-settings";
import { SLEEP_HOURS_LENGTH_MINUTES } from "@/lib/settings/sleep-hours";
import { addHours, formatClockTime } from "@/lib/settings/screen-time";
import { cn } from "@/lib/utils";
import type { SettingsRow } from "@/types/tiktok";

/** Where a new window starts, as live. */
const DEFAULT_START = "22:00";

const pad = (n: number) => String(n).padStart(2, "0");
const HOURS = ["12", ...Array.from({ length: 11 }, (_, index) => pad(index + 1))];
const MINUTES = Array.from({ length: 60 }, (_, minute) => pad(minute));
const MERIDIEM = ["AM", "PM"];

/** The live start-time picker: 12, 01…11 / 00…59 / AM PM, over an "HH:mm" value. */
function clockColumns(time: string, onChange: (time: string) => void): PickerColumn[] {
  const [hours, minutes] = time.split(":").map(Number);
  const set = (h: number, m: number) => onChange(`${pad(h)}:${pad(m)}`);
  const pm = hours >= 12;
  return [
    {
      label: "Hour",
      options: HOURS,
      selected: hours % 12,
      onSelect: (index) => set(index + (pm ? 12 : 0), minutes),
    },
    { label: "Minute", options: MINUTES, selected: minutes, onSelect: (index) => set(hours, index) },
    {
      label: "AM/PM",
      options: MERIDIEM,
      selected: pm ? 1 : 0,
      onSelect: (index) => set((hours % 12) + index * 12, minutes),
    },
  ];
}

/** Screen time → Sleep hours: "On" or "Off", opening its page. */
export function SleepHoursRow({
  row,
  account,
  onOpen,
}: {
  row: SettingsRow;
  account: AccountSettings;
  onOpen: () => void;
}) {
  const settings = account.settings;

  return (
    <DialogRowButton
      row={row}
      value={settings ? formatSleepHours(settings.sleepHoursStart) : undefined}
      onOpen={onOpen}
    />
  );
}

/**
 * Screen time → Sleep hours, in the panel as live shows it at
 * `/setting/sleep-reminder-edit`. Only the start is chosen; the server always
 * ends the window eight hours later, so End time just shows that.
 *
 * Measured live, in the 680 frame (`padding: 20px`):
 *   lead     16/20.8/400 `.88`, `margin: 0 8px 8px`
 *   switch   row `margin: 20px 8px`, 16/24/600; a 48 × 28 cyan (#20D5EC)
 *            track with a 22px white knob, 10px clear of the edge
 *   times    #121212, radius 12; rows 56 tall, `padding: 10px 16px`, 16/24
 *            labels; fields 140 × 36, radius 2, 1px `rgba(255,255,255,.12)`,
 *            a 16px clock 8px before 16/24 text; End — and Start too while
 *            the switch is off — on `rgba(255,255,255,.12)` with `.34` text
 *   note     13/16.9 `.6`, `margin: 4px 16px`
 *   buttons  124 × 48, radius 8, 16/21/500, 6px apart, right-aligned
 *            `margin: 20px 8px`: Cancel `rgba(255,255,255,.13)`, Save #FE2C55
 */
export function SleepHoursPage({
  account,
  onLeave,
}: {
  account: AccountSettings;
  onLeave: () => void;
}) {
  const settings = account.settings;
  useEffect(() => {
    if (!settings) onLeave();
  }, [settings, onLeave]);

  return settings ? (
    <SleepHours settings={settings} update={account.update} onLeave={onLeave} />
  ) : null;
}

function SleepHours({
  settings,
  update,
  onLeave,
}: {
  settings: UserSettingsResponse;
  update: AccountSettings["update"];
  onLeave: () => void;
}) {
  const [on, setOn] = useState(settings.sleepHoursStart !== null);
  const [start, setStart] = useState(settings.sleepHoursStart ?? DEFAULT_START);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      await update({ sleepHoursStart: on ? start : null });
      onLeave();
    } catch (cause) {
      toast.error(messageFor(cause));
      setSaving(false);
    }
  };

  const clock = <TimeClockIcon className="mr-2 h-4 w-4 flex-none" />;
  const field = "w-[140px] justify-start";
  const greyed = "bg-[rgb(255_255_255/0.12)] text-[rgb(255_255_255/0.34)]";

  return (
    <div className="p-5">
      <h1 className="mx-2 mb-5 text-[24px] leading-8 font-bold text-[rgb(255_255_255/0.9)]">
        Sleep hours
      </h1>
      <p className="mx-2 mb-2 text-[16px] leading-[20.8px] text-[rgb(255_255_255/0.88)]">
        To help you sleep, push notifications are muted during your sleep hours. We’ll remind
        you before and after they start.
      </p>

      <div className="mx-2 my-5 flex items-center justify-between">
        <span className="text-[16px] leading-6 font-semibold text-[rgb(255_255_255/0.9)]">
          Set your sleep hours
        </span>
        <span className="pr-2.5">
          <Switch
            on={on}
            label="Set your sleep hours"
            onToggle={() => setOn(!on)}
            variant="sleep"
          />
        </span>
      </div>

      {/* Off, live keeps the times on the page, greyed out. */}
      <div className="rounded-[12px] bg-[#121212]">
        <TimeRow label="Start time">
          <PickerField
            label="Start time"
            value={formatClockTime(start)}
            icon={clock}
            columns={clockColumns(start, setStart)}
            // Live drops it from the field's left edge, past the panel; ours
            // stays inside the panel, which would otherwise scroll sideways.
            align="end"
            disabled={!on}
            className={cn(field, !on && greyed)}
          />
        </TimeRow>
        <TimeRow label="End time">
          <PickerField
            label="End time"
            value={formatClockTime(addHours(start, SLEEP_HOURS_LENGTH_MINUTES / 60))}
            icon={clock}
            columns={[]}
            disabled
            className={cn(field, greyed)}
          />
        </TimeRow>
      </div>
      <p className="mx-4 mt-1 text-[13px] leading-[16.9px] text-[rgb(255_255_255/0.6)]">
        Sleep hours last for 8 hours after your start time
      </p>

      <div className="mx-2 my-5 flex justify-end gap-1.5">
        <button
          type="button"
          onClick={onLeave}
          className="h-12 w-[124px] rounded-[8px] bg-[rgb(255_255_255/0.13)] px-6 text-[16px] leading-[21px] font-medium text-[#f6f6f6]"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={() => void save()}
          disabled={saving}
          className="h-12 w-[124px] rounded-[8px] bg-[#fe2c55] px-6 text-[16px] leading-[21px] font-medium text-white disabled:opacity-50"
        >
          Save
        </button>
      </div>
    </div>
  );
}

function TimeRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex h-14 items-center justify-between px-4">
      <span className="text-[16px] leading-6 text-[rgb(255_255_255/0.9)]">{label}</span>
      {children}
    </div>
  );
}

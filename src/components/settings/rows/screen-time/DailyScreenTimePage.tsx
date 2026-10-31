"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

import { BellOutlineIcon, TimeClockIcon } from "@/components/icons";
import { CodeBoxes } from "@/components/session/auth-modal/CodeBoxes";
import { DialogRowButton } from "@/components/settings/rows/AccountRows";
import { Switch } from "@/components/settings/rows/parts";
import {
  PickerField,
  type PickerColumn,
} from "@/components/settings/rows/screen-time/PickerField";
import { Modal } from "@/components/ui/modal";
import { toast } from "@/components/ui/toast";
import type { AccountSettings } from "@/hooks/use-account-settings";
import { messageFor } from "@/lib/api/errors";
import type { UserSettingsPatch, UserSettingsResponse } from "@/lib/api/types";
import { emptyCode } from "@/lib/forms/code-digits";
import {
  DAILY_LIMIT_PRESETS,
  dailyLimitValue,
  formatLimit,
} from "@/lib/settings/account-settings";
import { cn } from "@/lib/utils";
import type { SettingsRow } from "@/types/tiktok";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/** The server's bounds on a daily limit, in minutes. */
const MIN_LIMIT = 10;
const MAX_LIMIT = 480;
/** Where a custom or per-day limit starts, as live. */
const DEFAULT_LIMIT = 60;
const PASSCODE_LENGTH = 4;

const HOURS = Array.from({ length: MAX_LIMIT / 60 + 1 }, (_, hours) => String(hours));
const MINUTES = Array.from({ length: 12 }, (_, step) => String(step * 5));

/** A picked number of hours and minutes, kept within the server's bounds. */
function limitOf(hours: number, minutes: number): number {
  return Math.min(MAX_LIMIT, Math.max(MIN_LIMIT, hours * 60 + minutes));
}

function limitColumns(limit: number, onChange: (limit: number) => void): PickerColumn[] {
  const hours = Math.floor(limit / 60);
  const minutes = limit % 60;
  return [
    {
      label: "Hours",
      options: HOURS,
      selected: hours,
      onSelect: (index) => onChange(limitOf(index, minutes)),
    },
    {
      label: "Minutes",
      options: MINUTES,
      selected: MINUTES.indexOf(String(minutes)),
      onSelect: (index) => onChange(limitOf(hours, index * 5)),
    },
  ];
}

/** Screen time → Daily screen time: "Off", or today's limit, opening its page. */
export function DailyScreenTimeRow({
  row,
  account,
  onOpen,
}: {
  row: SettingsRow;
  account: AccountSettings;
  onOpen: () => void;
}) {
  const [now] = useState(() => new Date());
  const settings = account.settings;

  return (
    <DialogRowButton
      row={row}
      value={settings ? dailyLimitValue(settings, now) : undefined}
      onOpen={onOpen}
    />
  );
}

/**
 * Screen time → Daily screen time, in the panel as live shows it at
 * `/setting/daily-screen-time-edit`. Nothing is saved until Done; turning a
 * limit on for the first time asks for the passcode that gets past it.
 *
 * Measured live, in the 680 frame (`padding: 20px`):
 *   title    24/32/700, `margin: 0 8px 20px`; lead 16/24/600 the same way
 *   rules    1px `rgba(255,255,255,.12)`
 *   info     16px glyph + 5px + 16/24/600 title, `margin: 20px 0 10px`; text
 *            16/24/400, `margin: 0 0 20px 21px`
 *   switch   row `margin: 20px 8px`, 16/24/600; a dark knob on the green
 *   options  #121212, `padding: 12px`; radios 16px with a 10px dot, 12px to
 *            16/24 labels; chips 36 tall, 14/21/600, radius 2, 1px
 *            `rgba(255,255,255,.12)` on #121212, 6px apart, Custom 120 wide —
 *            chosen, #FF3B5C text and border on `rgba(254,44,85,.1)`
 *   per day  day chips 81 wide and limit fields 80 wide, spread across 600
 *   Done     96 × 36, #FF3B5C, radius 2, 16/24/500, right-aligned 20 below
 */
export function DailyScreenTimePage({
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
    <DailyScreenTime settings={settings} update={account.update} onLeave={onLeave} />
  ) : null;
}

/** A chip's value: a preset, the custom limit, or nothing chosen yet. */
type Choice = number | "custom" | null;

function DailyScreenTime({
  settings,
  update,
  onLeave,
}: {
  settings: UserSettingsResponse;
  update: AccountSettings["update"];
  onLeave: () => void;
}) {
  const saved = settings.screenTimeLimitMinutes;
  const savedIsPreset = saved !== null && DAILY_LIMIT_PRESETS.includes(saved);
  const [on, setOn] = useState(saved !== null || settings.screenTimeLimitsByDay !== null);
  const [perDay, setPerDay] = useState(settings.screenTimeLimitsByDay !== null);
  const [choice, setChoice] = useState<Choice>(
    saved === null ? null : savedIsPreset ? saved : "custom",
  );
  const [custom, setCustom] = useState(saved !== null && !savedIsPreset ? saved : DEFAULT_LIMIT);
  const [days, setDays] = useState<number[]>(
    () => settings.screenTimeLimitsByDay ?? DAYS.map(() => DEFAULT_LIMIT),
  );
  /** The day whose chip is lit: the one last clicked or being picked. */
  const [day, setDay] = useState<number | null>(null);
  const [askPasscode, setAskPasscode] = useState(false);
  const [saving, setSaving] = useState(false);

  // The other shape always goes as null, so switching shapes clears the old one.
  const patch: UserSettingsPatch | null = !on
    ? { screenTimeLimitMinutes: null, screenTimeLimitsByDay: null }
    : perDay
      ? { screenTimeLimitMinutes: null, screenTimeLimitsByDay: days }
      : choice === null
        ? null
        : {
            screenTimeLimitMinutes: choice === "custom" ? custom : choice,
            screenTimeLimitsByDay: null,
          };

  const save = async (body: UserSettingsPatch) => {
    setSaving(true);
    try {
      await update(body);
      onLeave();
    } catch (cause) {
      toast.error(messageFor(cause));
      setSaving(false);
      setAskPasscode(false);
    }
  };

  const done = () => {
    if (!patch) return;
    if (on && !settings.hasScreenTimePasscode) setAskPasscode(true);
    else void save(patch);
  };

  return (
    <div className="p-5">
      <h1 className="mx-2 mb-5 text-[24px] leading-8 font-bold text-[rgb(255_255_255/0.9)]">
        Daily screen time
      </h1>
      <p className="mx-2 mb-5 text-[16px] leading-6 font-semibold text-[rgb(255_255_255/0.9)]">
        We’ll let you know if you reach your daily time to help you balance your day.
      </p>
      <Rule />
      <InfoLine
        icon={<TimeClockIcon className="h-4 w-4 flex-none" />}
        title="Set your daily time"
        text="Choose how long to spend on Nowa"
      />
      <InfoLine
        icon={<BellOutlineIcon className="h-4 w-4 flex-none" />}
        title="Get notified"
        text="Close Nowa to stay within your daily time, or enter a passcode to return to it"
      />
      <Rule />

      <div className="mx-2 my-5 flex items-center justify-between">
        <span className="text-[16px] leading-6 font-semibold text-[rgb(255_255_255/0.9)]">
          Set daily screen time
        </span>
        {/* Live, an empty 12px label trails the switch. */}
        <span className="pr-3">
          <Switch on={on} label="Set daily screen time" onToggle={() => setOn(!on)} variant="daily" />
        </span>
      </div>

      {on && (
        <div role="radiogroup" aria-label="Daily limit" className="bg-[#121212] p-3">
          <Radio
            checked={!perDay}
            label="Set the same limit every day"
            onSelect={() => setPerDay(false)}
          />
          {!perDay && (
            <div className="mx-2 my-5 flex items-start gap-1.5">
              {DAILY_LIMIT_PRESETS.map((minutes) => (
                <Chip
                  key={minutes}
                  selected={choice === minutes}
                  onClick={() => setChoice(minutes)}
                  className="flex-1"
                >
                  {formatLimit(minutes)}
                </Chip>
              ))}
              <div className="w-[120px] flex-none">
                <Chip
                  selected={choice === "custom"}
                  onClick={() => setChoice("custom")}
                  className="w-full"
                >
                  Custom
                </Chip>
                {choice === "custom" && (
                  <div className="mt-[15px]">
                    <PickerField
                      label="Custom limit"
                      value={formatLimit(custom)}
                      columns={limitColumns(custom, setCustom)}
                      className="w-full"
                    />
                  </div>
                )}
              </div>
            </div>
          )}

          <Radio
            checked={perDay}
            label="Set a custom limit per day"
            onSelect={() => setPerDay(true)}
            className={cn(perDay && "mt-[25px]")}
          />
          {perDay && (
            <>
              <div className="mx-2 my-5 flex justify-between">
                {DAYS.map((name, index) => (
                  <Chip
                    key={name}
                    selected={day === index}
                    onClick={() => setDay(index)}
                    className="w-[81px]"
                  >
                    {name}
                  </Chip>
                ))}
              </div>
              <div className="mx-2 my-5 flex justify-between">
                {DAYS.map((name, index) => (
                  <PickerField
                    key={name}
                    label={`${name} limit`}
                    value={formatLimit(days[index])}
                    columns={limitColumns(days[index], (limit) =>
                      setDays(days.map((old, at) => (at === index ? limit : old))),
                    )}
                    onOpen={() => setDay(index)}
                    // The last two would run past the panel's edge.
                    align={index >= DAYS.length - 2 ? "end" : "start"}
                    className="w-20"
                  />
                ))}
              </div>
            </>
          )}
        </div>
      )}

      <div className="mt-5 flex justify-end">
        <button
          type="button"
          onClick={done}
          disabled={!patch || saving}
          className="h-9 w-24 rounded-[2px] bg-[#ff3b5c] px-[15px] text-[16px] leading-6 font-medium text-white disabled:opacity-50"
        >
          Done
        </button>
      </div>

      {askPasscode && patch && (
        <PasscodeDialog
          busy={saving}
          onDone={(passcode) => void save({ ...patch, screenTimePasscode: passcode })}
          onClose={() => setAskPasscode(false)}
        />
      )}
    </div>
  );
}

function Rule() {
  return <div className="h-px bg-[rgb(255_255_255/0.12)]" />;
}

function InfoLine({ icon, title, text }: { icon: ReactNode; title: string; text: string }) {
  return (
    <>
      <p className="mt-5 mb-2.5 flex items-center text-[16px] leading-6 font-semibold text-[rgb(255_255_255/0.9)]">
        {icon}
        <span className="ml-[5px]">{title}</span>
      </p>
      <p className="mb-5 ml-[21px] text-[16px] leading-6 text-[rgb(255_255_255/0.9)]">{text}</p>
    </>
  );
}

function Radio({
  checked,
  label,
  onSelect,
  className,
}: {
  checked: boolean;
  label: string;
  onSelect: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={checked}
      onClick={onSelect}
      className={cn("flex w-full items-start text-left", className)}
    >
      <span
        className={cn(
          "mt-[3px] flex h-4 w-4 flex-none items-center justify-center rounded-full border",
          checked ? "border-[#ff3b5c]" : "border-[rgb(255_255_255/0.12)]",
        )}
      >
        {checked && <span className="h-2.5 w-2.5 rounded-full bg-[#ff3b5c]" />}
      </span>
      <span className="pl-3 text-[16px] leading-6 text-[rgb(255_255_255/0.9)]">{label}</span>
    </button>
  );
}

function Chip({
  selected,
  onClick,
  className,
  children,
}: {
  selected: boolean;
  onClick: () => void;
  className?: string;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={cn(
        "h-9 rounded-[2px] border px-[11px] text-[14px] leading-[21px] font-semibold",
        selected
          ? "border-[#ff3b5c] bg-[rgb(254_44_85/0.1)] text-[#ff3b5c]"
          : "border-[rgb(255_255_255/0.12)] bg-[#121212] text-[rgb(255_255_255/0.9)]",
        className,
      )}
    >
      {children}
    </button>
  );
}

/**
 * The four-digit passcode that gets past the limit, entered twice. A second
 * entry that differs starts over. Not observed live — TikTok's web page was
 * never taken past Done.
 */
function PasscodeDialog({
  busy,
  onDone,
  onClose,
}: {
  busy: boolean;
  onDone: (passcode: string) => void;
  onClose: () => void;
}) {
  const [first, setFirst] = useState<string | null>(null);
  const [digits, setDigits] = useState(() => emptyCode(PASSCODE_LENGTH));
  const [mismatch, setMismatch] = useState(false);
  const firstBox = useRef<HTMLInputElement>(null);

  useEffect(() => {
    firstBox.current?.focus();
  }, [first]);

  const onChange = (next: string[]) => {
    const code = next.join("");
    if (code.length < PASSCODE_LENGTH) return setDigits(next);

    if (first === null) {
      setFirst(code);
      setDigits(emptyCode(PASSCODE_LENGTH));
      setMismatch(false);
    } else if (code === first) {
      setDigits(next);
      onDone(code);
    } else {
      setFirst(null);
      setDigits(emptyCode(PASSCODE_LENGTH));
      setMismatch(true);
    }
  };

  return (
    <Modal onClose={onClose} className="w-[400px] rounded-[12px] p-6">
      <h2 className="text-center text-[20px] font-bold text-[var(--tt-text)]">
        {first === null ? "Create a passcode" : "Confirm passcode"}
      </h2>
      <p className="mt-1 text-center text-[14px] text-[var(--tt-text-secondary)]">
        {first === null
          ? "You’ll enter it to keep using Nowa after your daily time."
          : "Enter the same four digits again."}
      </p>
      <div className="mt-6 flex justify-center">
        <CodeBoxes
          digits={digits}
          onChange={onChange}
          disabled={busy}
          invalid={mismatch}
          firstRef={firstBox}
        />
      </div>
      {mismatch && (
        <p role="alert" className="mt-3 text-center text-[13px] text-[var(--tt-red-active)]">
          Passcodes don&apos;t match
        </p>
      )}
    </Modal>
  );
}

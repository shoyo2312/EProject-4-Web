"use client";

import { useState } from "react";

import { useSession } from "@/components/session/SessionProvider";
import { CommentFiltersModal } from "@/components/settings/rows/CommentFiltersModal";
import {
  Accessory,
  ROW_CLASS,
  RowBody,
  Switch,
} from "@/components/settings/rows/parts";
import { Modal } from "@/components/ui/modal";
import { toast } from "@/components/ui/toast";
import type { AccountSettings } from "@/hooks/use-account-settings";
import { messageFor } from "@/lib/api/errors";
import type { SettingsAudience } from "@/lib/api/types";
import { sleepHoursSchema } from "@/lib/forms/schemas";
import { useForm } from "@/lib/forms/use-form";
import {
  AUDIENCE_LABELS,
  formatScreenTimeLimit,
  formatSleepHours,
  screenTimeChoices,
} from "@/lib/settings/account-settings";
import { cn } from "@/lib/utils";
import type { SettingsRow } from "@/types/tiktok";

/*
 * The `/setting` rows backed by user-service's `user_settings`. One read feeds
 * them all (`AccountSettingsProvider`, in the root layout); each save PATCHes only
 * its own keys and repaints from the server's answer.
 */

interface AccountRowProps {
  row: SettingsRow;
  account: AccountSettings;
}

const AUDIENCES: SettingsAudience[] = ["EVERYONE", "FRIENDS", "NO_ONE"];

/**
 * Privacy → Comments / Direct messages. Both are enforced server-side —
 * interaction-service on each new comment, chat-service when a conversation
 * opens — so this is the one place the viewer changes who can reach them.
 */
export function AudienceRow({
  row,
  account,
  field,
}: AccountRowProps & { field: "commentAudience" | "dmAudience" }) {
  const [open, setOpen] = useState(false);
  const current = account.settings?.[field];

  return (
    <>
      <DialogRowButton
        row={row}
        value={current && AUDIENCE_LABELS[current]}
        onOpen={() => setOpen(true)}
      />
      {open && current && (
        <ChoiceModal
          title={row.title}
          description={row.description}
          choices={AUDIENCES.map((audience) => ({
            value: audience,
            label: AUDIENCE_LABELS[audience],
            description:
              audience === "FRIENDS" ? "Followers that you follow back" : undefined,
          }))}
          selected={current}
          onChoose={(audience) =>
            account.update(
              field === "commentAudience"
                ? { commentAudience: audience }
                : { dmAudience: audience },
            )
          }
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}

/**
 * Privacy → Comment filters, which interaction-service applies to each new
 * comment under the viewer's videos.
 */
export function CommentFiltersRow({ row, account }: AccountRowProps) {
  const [open, setOpen] = useState(false);
  const settings = account.settings;

  return (
    <>
      {/* A link row shows no value; "" only says the settings are in. */}
      <DialogRowButton
        row={row}
        value={settings ? "" : undefined}
        onOpen={() => setOpen(true)}
      />
      {open && settings && (
        <CommentFiltersModal
          settings={settings}
          update={account.update}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}

/**
 * Screen time → Daily screen time. Stored for every client to read back; no
 * server reads it, so the limit is only as live as a client that enforces it.
 */
export function ScreenTimeLimitRow({ row, account }: AccountRowProps) {
  const [open, setOpen] = useState(false);
  const settings = account.settings;

  return (
    <>
      <DialogRowButton
        row={row}
        value={
          settings ? formatScreenTimeLimit(settings.screenTimeLimitMinutes) : undefined
        }
        onOpen={() => setOpen(true)}
      />
      {open && settings && (
        <ChoiceModal
          title={row.title}
          description={row.description}
          choices={screenTimeChoices(settings.screenTimeLimitMinutes).map(
            (minutes) => ({ value: minutes, label: formatScreenTimeLimit(minutes) }),
          )}
          selected={settings.screenTimeLimitMinutes}
          onChoose={(minutes) =>
            account.update({ screenTimeLimitMinutes: minutes })
          }
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}

/** Screen time → Sleep hours. Wall-clock "HH:mm", read in the viewer's own zone. */
export function SleepHoursRow({ row, account }: AccountRowProps) {
  const [open, setOpen] = useState(false);
  const settings = account.settings;

  return (
    <>
      <DialogRowButton
        row={row}
        value={
          settings
            ? formatSleepHours(settings.sleepHoursStart, settings.sleepHoursEnd)
            : undefined
        }
        onOpen={() => setOpen(true)}
      />
      {open && settings && (
        <SleepHoursModal
          row={row}
          account={account}
          start={settings.sleepHoursStart}
          end={settings.sleepHoursEnd}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}

/** Privacy → Private account, and Screen time → Weekly screen time updates. */
export function AccountSwitchRow({
  row,
  account,
  field,
}: {
  row: Extract<SettingsRow, { kind: "switch" }>;
  account: AccountSettings;
  field: "privateAccount" | "weeklyScreenTimeDigest";
}) {
  const { requireSignIn } = useSession();
  /** Where the switch is headed while its save is in flight. */
  const [target, setTarget] = useState<boolean | null>(null);
  const on = target ?? account.settings?.[field] ?? row.on;

  const onToggle = () => {
    if (!requireSignIn() || !account.settings || target !== null) return;
    setTarget(!on);
    account
      .update({ [field]: !on })
      .catch((cause) => toast.error(messageFor(cause)))
      .finally(() => setTarget(null));
  };

  return (
    <div className={ROW_CLASS}>
      <RowBody row={row} />
      <Switch on={on} label={row.title} onToggle={onToggle} />
    </div>
  );
}

/**
 * A row that opens a dialog over the account's settings. `value` is undefined
 * until they have loaded: signed out, the row keeps its static copy; signed in,
 * it stays blank rather than flash the default before the real answer.
 */
function DialogRowButton({
  row,
  value,
  onOpen,
}: {
  row: SettingsRow;
  value: string | undefined;
  onOpen: () => void;
}) {
  const { isSignedIn, isLoading, requireSignIn } = useSession();
  const shown = value ?? (isSignedIn || isLoading ? "" : undefined);

  return (
    <button
      type="button"
      onClick={() => {
        if (requireSignIn() && value !== undefined) onOpen();
      }}
      className={cn(ROW_CLASS, "hover:bg-white/[0.03]")}
    >
      <RowBody row={row} />
      <Accessory row={row} value={shown} />
    </button>
  );
}

interface Choice<T> {
  value: T;
  label: string;
  description?: string;
}

/**
 * A single-answer picker that saves on the tap and closes once the server has
 * it. A failed save keeps the dialog open on the old answer.
 */
function ChoiceModal<T>({
  title,
  description,
  choices,
  selected,
  onChoose,
  onClose,
}: {
  title: string;
  description?: string;
  choices: Choice<T>[];
  selected: T;
  onChoose: (value: T) => Promise<void>;
  onClose: () => void;
}) {
  const [pending, setPending] = useState<Choice<T> | null>(null);

  const choose = async (choice: Choice<T>) => {
    if (choice.value === selected) return onClose();
    setPending(choice);
    try {
      await onChoose(choice.value);
      onClose();
    } catch (cause) {
      toast.error(messageFor(cause));
      setPending(null);
    }
  };

  return (
    <Modal onClose={onClose} className="w-[400px] rounded-[12px] p-6">
      <h2 className="text-center text-[20px] font-bold text-[var(--tt-text)]">
        {title}
      </h2>
      {description && (
        <p className="mt-1 text-center text-[14px] text-[var(--tt-text-secondary)]">
          {description}
        </p>
      )}

      <div role="radiogroup" aria-label={title} className="mt-4">
        {choices.map((choice) => {
          const checked = pending ? choice === pending : choice.value === selected;
          return (
            <button
              key={choice.label}
              type="button"
              role="radio"
              aria-checked={checked}
              disabled={pending !== null}
              onClick={() => choose(choice)}
              className="flex w-full items-center gap-3 rounded-[8px] px-2 py-3 text-left transition-colors hover:bg-white/[0.08] disabled:cursor-default"
            >
              <span className="min-w-0 flex-1">
                <span className="block text-[16px] leading-[22px] text-[var(--tt-text)]">
                  {choice.label}
                </span>
                {choice.description && (
                  <span className="block text-[12px] leading-4 text-[var(--tt-text-secondary)]">
                    {choice.description}
                  </span>
                )}
              </span>
              <span
                className={cn(
                  "flex h-5 w-5 flex-none items-center justify-center rounded-full border-2",
                  checked ? "border-[var(--tt-red)]" : "border-white/40",
                )}
              >
                {checked && (
                  <span className="h-2.5 w-2.5 rounded-full bg-[var(--tt-red)]" />
                )}
              </span>
            </button>
          );
        })}
      </div>
    </Modal>
  );
}

function SleepHoursModal({
  row,
  account,
  start,
  end,
  onClose,
}: AccountRowProps & {
  start: string | null;
  end: string | null;
  onClose: () => void;
}) {
  const form = useForm({
    schema: sleepHoursSchema,
    initialValues: { start: start ?? "22:00", end: end ?? "07:00" },
    onSubmit: async (values) => {
      await account.update({ sleepHoursStart: values.start });
      onClose();
    },
  });

  const [turningOff, setTurningOff] = useState(false);
  const busy = form.submitting || turningOff;

  const turnOff = async () => {
    setTurningOff(true);
    try {
      await account.update({ sleepHoursStart: null });
      onClose();
    } catch (cause) {
      toast.error(messageFor(cause));
      setTurningOff(false);
    }
  };

  return (
    <Modal onClose={onClose} className="w-[400px] rounded-[12px] p-6">
      <form onSubmit={form.handleSubmit} noValidate>
        <h2 className="text-center text-[20px] font-bold text-[var(--tt-text)]">
          {row.title}
        </h2>
        {row.description && (
          <p className="mt-1 text-center text-[14px] text-[var(--tt-text-secondary)]">
            {row.description}
          </p>
        )}

        <div className="mt-5 grid grid-cols-2 gap-3">
          <TimeField label="Start" {...form.field("start")} />
          <TimeField label="End" {...form.field("end")} />
        </div>

        {form.formError && (
          <p className="mt-3 text-[13px] text-[var(--tt-red-active)]">
            {form.formError}
          </p>
        )}

        <button
          type="submit"
          disabled={busy}
          className="mt-6 h-11 w-full rounded-[8px] bg-[var(--tt-red)] text-[15px] font-semibold text-white transition-colors hover:bg-[var(--tt-red-hover)] disabled:opacity-60"
        >
          {form.submitting ? "Saving…" : "Save"}
        </button>
        {start && (
          <button
            type="button"
            onClick={turnOff}
            disabled={busy}
            className="mt-2 h-11 w-full rounded-[8px] bg-[var(--tt-field)] text-[15px] font-semibold text-[var(--tt-text)] transition-colors hover:bg-[var(--tt-shape-neutral-3)] disabled:opacity-60"
          >
            {turningOff ? "Turning off…" : "Turn off"}
          </button>
        )}
      </form>
    </Modal>
  );
}

function TimeField({
  label,
  name,
  value,
  error,
  onChange,
  ref,
}: {
  label: string;
  name: string;
  value: string;
  error?: string;
  onChange: (value: string) => void;
  ref: React.Ref<HTMLInputElement>;
}) {
  return (
    <label className="block">
      <span className="text-[14px] font-semibold text-[var(--tt-text)]">{label}</span>
      <input
        ref={ref}
        type="time"
        name={name}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        aria-invalid={error ? true : undefined}
        className={cn(
          "mt-1 w-full rounded-[8px] border bg-[var(--tt-field)] px-3 py-2 text-[15px] text-[var(--tt-text)] [color-scheme:dark]",
          error ? "border-[var(--tt-red-active)]" : "border-[var(--tt-divider)]",
        )}
      />
      {error && (
        <span className="mt-1 block text-[12px] text-[var(--tt-red-active)]">
          {error}
        </span>
      )}
    </label>
  );
}

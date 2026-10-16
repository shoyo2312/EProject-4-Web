"use client";

import { useMemo, useState } from "react";

import { CloseIcon } from "@/components/icons";
import { Switch } from "@/components/settings/rows/parts";
import { Modal } from "@/components/ui/modal";
import { toast } from "@/components/ui/toast";
import type { AccountSettings } from "@/hooks/use-account-settings";
import { messageFor } from "@/lib/api/errors";
import type { UserSettingsResponse } from "@/lib/api/types";
import { COMMENT_KEYWORDS_MAX, commentKeywordSchemaFor } from "@/lib/forms/schemas";
import { useForm } from "@/lib/forms/use-form";
import { cn } from "@/lib/utils";

type FilterPatch = Partial<
  Pick<UserSettingsResponse, "filterAllComments" | "filterSpamOffensive" | "commentKeywords">
>;

/**
 * Privacy → Comment filters. interaction-service holds a matching comment for
 * the owner's review instead of refusing it — the queue sits at the top of
 * each video's comments. Every change saves on the spot, one at a time, and
 * the keyword list goes whole because the server replaces it.
 */
export function CommentFiltersModal({
  settings,
  update,
  onClose,
}: {
  settings: UserSettingsResponse;
  update: AccountSettings["update"];
  onClose: () => void;
}) {
  /** The change in flight, shown ahead of the server's answer. */
  const [saving, setSaving] = useState<FilterPatch | null>(null);
  const shown = { ...settings, ...saving };

  const schema = useMemo(
    () => commentKeywordSchemaFor(settings.commentKeywords),
    [settings.commentKeywords],
  );
  const form = useForm({
    schema,
    initialValues: { keyword: "" },
    onSubmit: async ({ keyword }) => {
      await update({ commentKeywords: [...settings.commentKeywords, keyword.trim()] });
      form.reset({ keyword: "" });
    },
  });
  const busy = saving !== null || form.submitting;

  const save = (patch: FilterPatch) => {
    if (busy) return;
    setSaving(patch);
    update(patch)
      .catch((cause) => toast.error(messageFor(cause)))
      .finally(() => setSaving(null));
  };

  return (
    <Modal onClose={onClose} className="w-[400px] rounded-[12px] p-6">
      <h2 className="text-center text-[20px] font-bold text-[var(--tt-text)]">
        Comment filters
      </h2>
      <p className="mt-1 text-center text-[14px] text-[var(--tt-text-secondary)]">
        Filtered comments wait for your review at the top of each video’s comments.
      </p>

      <FilterSwitch
        title="Filter all comments"
        description="Only comments you approve will appear."
        on={shown.filterAllComments}
        onToggle={() => save({ filterAllComments: !shown.filterAllComments })}
      />
      <FilterSwitch
        title="Filter spam and offensive comments"
        description="Hate speech, threats and scams are held either way."
        on={shown.filterSpamOffensive}
        onToggle={() => save({ filterSpamOffensive: !shown.filterSpamOffensive })}
      />

      <div className="mt-5">
        <p className="text-[16px] leading-[21px] text-[var(--tt-text)]">Filter keywords</p>
        <p className="mt-1 text-[12px] leading-[15.6px] text-[rgb(255_255_255/0.6)]">
          Comments with these keywords wait for your review.
        </p>

        <form onSubmit={form.handleSubmit} noValidate className="mt-3 flex items-start gap-2">
          <KeywordField {...form.field("keyword")} />
          <button
            type="submit"
            disabled={busy}
            className="h-10 flex-none rounded-[8px] bg-[var(--tt-red)] px-4 text-[15px] font-semibold text-white transition-colors hover:bg-[var(--tt-red-hover)] disabled:opacity-60"
          >
            Add
          </button>
        </form>

        {shown.commentKeywords.length > 0 && (
          <ul aria-label="Filtered keywords" className="mt-3 flex flex-wrap gap-2">
            {shown.commentKeywords.map((word) => (
              <li
                key={word}
                className="flex items-center gap-1 rounded-full bg-[var(--tt-field)] py-1 pr-1 pl-3 text-[14px] text-[var(--tt-text)]"
              >
                <span className="max-w-[260px] truncate">{word}</span>
                <button
                  type="button"
                  aria-label={`Remove ${word}`}
                  onClick={() =>
                    save({
                      commentKeywords: shown.commentKeywords.filter((other) => other !== word),
                    })
                  }
                  className="flex h-6 w-6 flex-none items-center justify-center rounded-full text-[var(--tt-icon)] transition-colors hover:bg-white/[0.12]"
                >
                  <CloseIcon className="h-3 w-3" />
                </button>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-2 text-right text-[12px] text-[var(--tt-text-secondary)]">
          {shown.commentKeywords.length}/{COMMENT_KEYWORDS_MAX}
        </p>
      </div>
    </Modal>
  );
}

function KeywordField({
  name,
  value,
  error,
  onChange,
  ref,
}: {
  name: string;
  value: string;
  error?: string;
  onChange: (value: string) => void;
  ref: React.Ref<HTMLInputElement>;
}) {
  return (
    <div className="min-w-0 flex-1">
      <input
        ref={ref}
        name={name}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Add a keyword"
        aria-label="Add a keyword"
        aria-invalid={error ? true : undefined}
        className={cn(
          "h-10 w-full rounded-[8px] border bg-[var(--tt-field)] px-3 text-[15px] text-[var(--tt-text)] outline-none placeholder:text-[var(--tt-placeholder)]",
          error ? "border-[var(--tt-red-active)]" : "border-[var(--tt-divider)]",
        )}
      />
      {error && (
        <p role="alert" className="mt-1 text-[12px] text-[var(--tt-red-active)]">
          {error}
        </p>
      )}
    </div>
  );
}

function FilterSwitch({
  title,
  description,
  on,
  onToggle,
}: {
  title: string;
  description: string;
  on: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="mt-5 flex items-center gap-4">
      <div className="min-w-0 flex-1">
        <p className="text-[16px] leading-[21px] text-[var(--tt-text)]">{title}</p>
        <p className="mt-1 text-[12px] leading-[15.6px] text-[rgb(255_255_255/0.6)]">
          {description}
        </p>
      </div>
      <Switch on={on} label={title} onToggle={onToggle} />
    </div>
  );
}

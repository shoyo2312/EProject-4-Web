"use client";

import { useEffect, useState } from "react";

import {
  CheckboxTickIcon,
  ClearCircleIcon,
  FriendsOutlineIcon,
  HouseOutlineIcon,
  PersonPlusOutlineIcon,
  ThinPlusIcon,
} from "@/components/icons";
import { useSession } from "@/components/session/SessionProvider";
import { Accessory, ROW_CLASS, RowBody } from "@/components/settings/rows/parts";
import { toast } from "@/components/ui/toast";
import { messageFor } from "@/lib/api/errors";
import {
  createKeywordFilter,
  deleteKeywordFilter,
  listKeywordFilters,
  updateKeywordFilter,
  type KeywordFilter,
} from "@/lib/api/keyword-filters";
import {
  feedsLabel,
  KEYWORD_FEEDS,
  KEYWORD_MAX_LENGTH,
  keywordError,
  type KeywordFeeds,
} from "@/lib/settings/keyword-filters";
import { cn } from "@/lib/utils";
import type { SettingsRow } from "@/types/tiktok";

const FEED_ICONS = {
  forYou: HouseOutlineIcon,
  following: PersonPlusOutlineIcon,
  friends: FriendsOutlineIcon,
} as const;

const NO_FEEDS: KeywordFeeds = { forYou: false, following: false, friends: false };

/** Content preferences → Filter keywords. Signed out, it asks to log in first. */
export function KeywordFiltersRow({ row, onOpen }: { row: SettingsRow; onOpen: () => void }) {
  const { requireSignIn } = useSession();

  return (
    <button
      type="button"
      onClick={() => {
        if (requireSignIn()) onOpen();
      }}
      className={cn(ROW_CLASS, "hover:bg-white/[0.03]")}
    >
      <RowBody row={row} />
      <Accessory row={row} />
    </button>
  );
}

/** The list, or the form for a new keyword or for the one being edited. */
type View = { kind: "list" } | { kind: "form"; editing: KeywordFilter | null };

/**
 * Content preferences → Filter keywords, in the panel. Live these are two
 * routes, `/setting/keyword-filtering` and `…/add-edit`; here the page swaps
 * between them. video-service leaves a video out of each feed ticked for a
 * keyword its title, description or tags carry.
 *
 * Measured live, in the 680 frame:
 *   list     `padding: 24px`: title 24/30/700 #F6F6F6, line 16/20.8 `.88`;
 *            40 below, right-aligned, a 190 × 52 #FE2C55 pill with a 20px plus
 *            and 16/20.8/500 "Add keyword" 4px after it, centred. TikTok's list was
 *            empty, so the keyword rows are ours.
 *   form     on #1E1E1E: title 28/35/700, line 13/16.9 `.6`; 40 below, a
 *            48-tall field on `rgba(255,255,255,.13)`, radius 8, a clear disc
 *            once typed into, and "n/200" 13/16.9 `.6` 8 under it at the right
 *   feeds    once typed into, 30 below: a black box (`padding: 0 12px`) with
 *            "Filter from" 14/18.2/500 `.6` and a red "Select all", then
 *            #1E1E1E radius 8 rows 51 tall — 20px glyph, 16/20.8/500 label,
 *            20px checkbox, radius 5: `inset 1.5px rgba(255,255,255,.32)`, or
 *            #FE2C55 with a white tick. Live also offers LIVE, which this app
 *            does not have.
 *   save     160 × 52, #FE2C55, radius 8, 16/20.8/500, 40 below, at `.4`
 *            until there is a keyword and a feed
 */
export function KeywordFiltersPage({ onLeave }: { onLeave: () => void }) {
  const { user } = useSession();
  useEffect(() => {
    if (!user) onLeave();
  }, [user, onLeave]);

  return user ? <KeywordFilters /> : null;
}

/** Mounted only while signed in, so every read below is the viewer's own. */
function KeywordFilters() {
  const [filters, setFilters] = useState<KeywordFilter[] | null>(null);
  const [view, setView] = useState<View>({ kind: "list" });

  useEffect(() => {
    let cancelled = false;
    listKeywordFilters().then(
      (list) => {
        if (!cancelled) setFilters(list);
      },
      (cause) => {
        if (cancelled) return;
        toast.error(messageFor(cause));
        setFilters([]);
      },
    );
    return () => {
      cancelled = true;
    };
  }, []);

  if (view.kind === "form") {
    return (
      <KeywordForm
        editing={view.editing}
        existing={filters ?? []}
        onSaved={(saved) => {
          setFilters((list) => {
            const current = list ?? [];
            return current.some((filter) => filter.id === saved.id)
              ? current.map((filter) => (filter.id === saved.id ? saved : filter))
              : [saved, ...current];
          });
          setView({ kind: "list" });
        }}
      />
    );
  }

  return (
    <div>
      <div className="p-6">
        <h1 className="text-[24px] leading-[30px] font-bold text-[#f6f6f6]">Filter keywords</h1>
        <p className="text-[16px] leading-[20.8px] text-[rgb(255_255_255/0.88)]">
          When you filter a keyword, you won’t see posts in your selected feeds that contain that
          word in any titles, descriptions, or stickers.
        </p>
      </div>

      <div className="mt-10 flex justify-end px-6">
        <button
          type="button"
          onClick={() => setView({ kind: "form", editing: null })}
          disabled={filters === null}
          className="flex h-[52px] min-w-[190px] items-center justify-center rounded-full bg-[#fe2c55] px-6 text-white transition-opacity disabled:opacity-40"
        >
          <ThinPlusIcon className="h-5 w-5 flex-none" />
          <span className="ml-1 text-[16px] leading-[20.8px] font-medium">Add keyword</span>
        </button>
      </div>

      {filters && filters.length > 0 && (
        <ul className="mt-4">
          {filters.map((filter) => (
            <KeywordRow
              key={filter.id}
              filter={filter}
              onEdit={() => setView({ kind: "form", editing: filter })}
              onDeleted={() =>
                setFilters((list) => (list ?? []).filter((other) => other.id !== filter.id))
              }
            />
          ))}
        </ul>
      )}
    </div>
  );
}

const ROW_BUTTON =
  "h-8 flex-none rounded-[4px] bg-[rgb(255_255_255/0.13)] px-3 text-[14px] leading-[18.2px] font-medium text-[#f6f6f6] transition-colors hover:bg-[rgb(255_255_255/0.2)] disabled:opacity-40";

function KeywordRow({
  filter,
  onEdit,
  onDeleted,
}: {
  filter: KeywordFilter;
  onEdit: () => void;
  onDeleted: () => void;
}) {
  const [deleting, setDeleting] = useState(false);

  const remove = async () => {
    setDeleting(true);
    try {
      await deleteKeywordFilter(filter.id);
      onDeleted();
    } catch (cause) {
      toast.error(messageFor(cause));
      setDeleting(false);
    }
  };

  return (
    <li className="flex items-center gap-2 border-b border-[var(--tt-divider)] px-6 py-3 last:border-b-0">
      <div className="min-w-0 flex-1">
        <p className="truncate text-[16px] leading-[20.8px] font-medium text-[#f6f6f6]">
          {filter.keyword}
        </p>
        <p className="mt-0.5 text-[13px] leading-[16.9px] text-[rgb(255_255_255/0.6)]">
          {feedsLabel(filter)}
        </p>
      </div>
      <button
        type="button"
        aria-label={`Edit ${filter.keyword}`}
        onClick={onEdit}
        disabled={deleting}
        className={ROW_BUTTON}
      >
        Edit
      </button>
      <button
        type="button"
        aria-label={`Delete ${filter.keyword}`}
        onClick={() => void remove()}
        disabled={deleting}
        className={ROW_BUTTON}
      >
        Delete
      </button>
    </li>
  );
}

function KeywordForm({
  editing,
  existing,
  onSaved,
}: {
  editing: KeywordFilter | null;
  existing: KeywordFilter[];
  onSaved: (saved: KeywordFilter) => void;
}) {
  const [text, setText] = useState(editing?.keyword ?? "");
  const [feeds, setFeeds] = useState<KeywordFeeds>(() =>
    editing
      ? { forYou: editing.forYou, following: editing.following, friends: editing.friends }
      : NO_FEEDS,
  );
  const [saving, setSaving] = useState(false);

  const keyword = text.trim();
  const others = existing.filter((filter) => filter.id !== editing?.id).map((f) => f.keyword);
  const error = keyword ? keywordError(keyword, others) : null;
  const canSave =
    keyword !== "" && error === null && (feeds.forYou || feeds.following || feeds.friends);

  const save = async () => {
    setSaving(true);
    const input = { keyword, ...feeds };
    try {
      onSaved(
        editing ? await updateKeywordFilter(editing.id, input) : await createKeywordFilter(input),
      );
    } catch (cause) {
      toast.error(messageFor(cause));
      setSaving(false);
    }
  };

  return (
    <div className="min-h-full bg-[#1e1e1e]">
      <div className="p-6">
        <div className="px-3">
          <h1 className="text-[28px] leading-[35px] font-bold text-[#f6f6f6]">
            {editing ? "Edit keyword" : "Add keyword"}
          </h1>
          <p className="text-[13px] leading-[16.9px] text-[rgb(255_255_255/0.6)]">
            Enter a single word or hashtag to filter from selected feeds. Spelling isn’t
            case-sensitive.
          </p>
        </div>

        <div className="mt-10 px-3">
          <div className="flex h-12 items-center rounded-[8px] bg-[rgb(255_255_255/0.13)] px-3">
            <input
              aria-label="Keyword"
              value={text}
              onChange={(event) => setText(event.target.value)}
              placeholder="Enter a word or hashtag"
              autoComplete="off"
              className="h-full min-w-0 flex-1 bg-transparent px-0.5 text-[16px] leading-[20.8px] text-[#f6f6f6] caret-[#fe2c55] outline-none placeholder:text-[rgb(255_255_255/0.6)]"
            />
            {text && (
              <button
                type="button"
                aria-label="Clear"
                onClick={() => setText("")}
                className="ml-2 flex-none text-[rgb(255_255_255/0.4)]"
              >
                <ClearCircleIcon className="h-[19px] w-[19px]" />
              </button>
            )}
          </div>
          <div className="mt-2 flex gap-3 pr-1 text-[13px] leading-[16.9px]">
            {error && <span className="text-[rgb(255_76_58)]">{error}</span>}
            <span className="ml-auto text-[rgb(255_255_255/0.6)]">
              {[...text].length}/{KEYWORD_MAX_LENGTH}
            </span>
          </div>
        </div>
      </div>

      <div className="px-3 pt-[30px]">
        {keyword && (
          <div className="bg-black px-3">
            <div className="mb-2 flex items-center justify-between px-4 pt-[18px] pb-1">
              <span className="text-[14px] leading-[18.2px] font-medium text-[rgb(255_255_255/0.6)]">
                Filter from
              </span>
              <button
                type="button"
                onClick={() => setFeeds({ forYou: true, following: true, friends: true })}
                className="h-11 text-[16px] leading-[20.8px] font-medium text-[#ff3b5c]"
              >
                Select all
              </button>
            </div>
            <div className="rounded-[8px] bg-[#1e1e1e]">
              {KEYWORD_FEEDS.map(({ field, label }) => {
                const Glyph = FEED_ICONS[field];
                const checked = feeds[field];
                return (
                  <label key={field} className="flex h-[51px] cursor-pointer items-center px-4">
                    <Glyph className="mr-2 h-5 w-5 flex-none text-[#f6f6f6]" />
                    <span className="min-w-0 flex-1 text-[16px] leading-[20.8px] font-medium text-[#f6f6f6]">
                      {label}
                    </span>
                    <span className="relative ml-2 flex h-5 w-5 flex-none">
                      <input
                        type="checkbox"
                        aria-label={label}
                        checked={checked}
                        onChange={() => setFeeds({ ...feeds, [field]: !checked })}
                        className="peer absolute inset-0 cursor-pointer opacity-0"
                      />
                      <span
                        className={cn(
                          "flex h-full w-full items-center justify-center rounded-[5px] text-white peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-white",
                          checked
                            ? "bg-[#fe2c55]"
                            : "shadow-[inset_0_0_0_1.5px_rgb(255_255_255/0.32)]",
                        )}
                      >
                        {checked && <CheckboxTickIcon className="h-5 w-5" />}
                      </span>
                    </span>
                  </label>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <div className="mt-10 flex justify-end px-6 pb-6">
        <button
          type="button"
          onClick={() => void save()}
          disabled={!canSave || saving}
          className="h-[52px] w-40 rounded-[8px] bg-[#fe2c55] px-6 text-[16px] leading-[20.8px] font-medium text-white disabled:opacity-40"
        >
          Save
        </button>
      </div>
    </div>
  );
}

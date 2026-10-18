"use client";

import Image from "next/image";

import { BoldCheckIcon } from "@/components/icons";
import { DATA_EXPORT_CATEGORIES } from "@/lib/account/data-export";
import type { DataExportCategory, DataExportFormat } from "@/lib/api/data-export";
import { cn } from "@/lib/utils";

const FORMATS: { value: DataExportFormat; label: string; description: string }[] = [
  { value: "TXT", label: "TXT", description: "Easy-to-read text file" },
  { value: "JSON", label: "JSON", description: "Allows other services to import your file" },
];

const SECTION_TITLE = "mt-4 text-[17px] leading-[22.1px] font-medium text-[rgb(246_246_246)]";
const BOX = "rounded-[8px] bg-[#2c2c2c] p-4";

/**
 * "Request data": the file format, then which data goes in. Locked while a
 * request is processing, as live — the controls fade to `.4` and stop
 * answering.
 *
 * Measured live (in the 664-wide column, 15 of it scrollbar):
 *   titles   17/22.1/500 #F6F6F6, 16 above; the data one has a 14/18.2 `.6`
 *            line 8 under it
 *   boxes    #2C2C2C, radius 8, `padding: 16px`, 12 under the format title
 *            and 8 under the data line
 *   format   label 16/20.8, note 13/16.9 `.6`, 24 between the two; a 24px
 *            radio — checked a #FE2C55 ring around a white dot, unchecked a
 *            1.5px `.32` ring on a `.13` disc
 *   data     a 40-tall header: 20px app icon, name 16/20.8/500 4 either side,
 *            count 13/16.9 `.6`, "Deselect all" 16/21/500 #FF3B5C; rows 24
 *            tall, `padding-left: 4px`, 16 then 24 apart, label 16/20.8,
 *            note 13/16.9 `.6`; a 20px #FE2C55 box, radius 4, in a 24px cell
 */
export function RequestDataTab({
  format,
  onFormat,
  selected,
  onSelected,
  locked,
}: {
  format: DataExportFormat;
  onFormat: (format: DataExportFormat) => void;
  selected: DataExportCategory[];
  onSelected: (categories: DataExportCategory[]) => void;
  locked: boolean;
}) {
  const all = selected.length === DATA_EXPORT_CATEGORIES.length;

  const toggle = (value: DataExportCategory) =>
    onSelected(
      DATA_EXPORT_CATEGORIES.map((c) => c.value).filter((v) =>
        v === value ? !selected.includes(v) : selected.includes(v),
      ),
    );

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <h2 className={SECTION_TITLE}>Select file format</h2>
      <div role="radiogroup" aria-label="File format" className={cn(BOX, "mt-3")}>
        {FORMATS.map((option, index) => (
          <label
            key={option.value}
            className={cn(
              "flex items-start justify-between",
              index > 0 && "mt-6",
              locked ? "cursor-not-allowed" : "cursor-pointer",
            )}
          >
            <span className="min-w-0">
              <span className="block text-[16px] leading-6 text-[rgb(246_246_246)]">{option.label}</span>
              <span className="mt-1 block text-[13px] leading-[16.9px] text-[rgb(255_255_255/0.6)]">
                {option.description}
              </span>
            </span>
            <FormatRadio
              checked={format === option.value}
              disabled={locked}
              onPick={() => onFormat(option.value)}
              label={option.label}
            />
          </label>
        ))}
      </div>

      <h2 className={SECTION_TITLE}>Select data to download</h2>
      <p className="mt-2 text-[14px] leading-[18.2px] text-[rgb(255_255_255/0.6)]">
        Choose which apps and data you want to include in your file.
      </p>
      <div className={cn(BOX, "mt-2")}>
        <div className="flex h-10 items-center justify-between">
          <div className="flex items-center">
            <Image
              src="/images/brand/nowa-icon.png"
              alt=""
              width={171}
              height={183}
              className="h-5 w-auto rounded-[4px]"
            />
            <span className="mx-1 text-[16px] leading-[20.8px] font-medium text-[rgb(246_246_246)]">Nowa</span>
            <span className="mt-0.5 ml-1 text-[13px] leading-[16.9px] text-[rgb(255_255_255/0.6)]">
              {selected.length}/{DATA_EXPORT_CATEGORIES.length} selected
            </span>
          </div>
          <button
            type="button"
            disabled={locked}
            onClick={() => onSelected(all ? [] : DATA_EXPORT_CATEGORIES.map((c) => c.value))}
            className="text-[16px] leading-[21px] font-medium text-[rgb(255_59_92)] disabled:cursor-not-allowed disabled:opacity-40"
          >
            {all ? "Deselect all" : "Select all"}
          </button>
        </div>

        {DATA_EXPORT_CATEGORIES.map((category, index) => (
          <label
            key={category.value}
            className={cn(
              "flex items-start justify-between pl-1",
              index === 0 ? "mt-4" : "mt-6",
              locked ? "cursor-not-allowed" : "cursor-pointer",
            )}
          >
            <span className="min-w-0 pr-3">
              <span className="block text-[16px] leading-6 text-[rgb(246_246_246)]">{category.label}</span>
              {category.description && (
                <span className="block text-[13px] leading-[16.9px] text-[rgb(255_255_255/0.6)]">
                  {category.description}
                </span>
              )}
            </span>
            <CategoryCheckbox
              checked={selected.includes(category.value)}
              disabled={locked}
              onToggle={() => toggle(category.value)}
            />
          </label>
        ))}
      </div>
    </div>
  );
}

function FormatRadio({
  checked,
  disabled,
  onPick,
  label,
}: {
  checked: boolean;
  disabled: boolean;
  onPick: () => void;
  label: string;
}) {
  return (
    <span className={cn("relative h-6 w-6 flex-none", disabled && "opacity-40")}>
      <input
        type="radio"
        name="data-export-format"
        aria-label={label}
        checked={checked}
        disabled={disabled}
        onChange={onPick}
        className="peer absolute inset-0 cursor-[inherit] rounded-full opacity-0"
      />
      <svg
        viewBox="0 0 24 24"
        aria-hidden
        className="h-6 w-6 rounded-full peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-white"
      >
        {checked ? (
          <>
            <circle cx="12" cy="12" r="9.25" fill="none" stroke="var(--tt-red)" strokeWidth="1.5" />
            <circle cx="12" cy="12" r="6.5" fill="#fff" stroke="var(--tt-red)" strokeWidth="4.2" />
          </>
        ) : (
          <>
            <circle cx="12" cy="12" r="8.5" fill="rgb(255 255 255 / 0.13)" />
            <circle cx="12" cy="12" r="9.25" fill="none" stroke="rgb(255 255 255 / 0.32)" strokeWidth="1.5" />
          </>
        )}
      </svg>
    </span>
  );
}

function CategoryCheckbox({
  checked,
  disabled,
  onToggle,
}: {
  checked: boolean;
  disabled: boolean;
  onToggle: () => void;
}) {
  return (
    <span className={cn("relative flex h-6 w-6 flex-none p-0.5", disabled && "opacity-40")}>
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={onToggle}
        className="peer absolute inset-0 cursor-[inherit] opacity-0"
      />
      <span
        className={cn(
          "flex h-5 w-5 items-center justify-center rounded-[4px] text-white peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-white",
          checked ? "bg-[var(--tt-red)]" : "border border-[rgb(255_255_255/0.32)]",
        )}
      >
        {checked && <BoldCheckIcon className="h-[11px] w-3" />}
      </span>
    </span>
  );
}

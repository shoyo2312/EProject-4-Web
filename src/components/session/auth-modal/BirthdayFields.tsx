"use client";

import { MONTHS } from "@/lib/forms/schemas";

import { Dropdown } from "./Dropdown";
import { FieldHeading } from "./ModalFields";

/** 1–31, and a hundred years back from this one, the way the live lists run. */
const DAYS = Array.from({ length: 31 }, (_, index) => String(index + 1));
const THIS_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: 100 }, (_, index) => String(THIS_YEAR - index));

type FieldProps = {
  value: string;
  onChange: (value: string) => void;
  ref: (node: { focus: () => void } | null) => void;
};

/**
 * "When's your birthday?" over the month, day and year selects. The three
 * validate as one `birthday` error, which `form` keys on the Month select.
 */
export function BirthdayFields({
  form,
}: {
  form: {
    field: (name: string, options?: { focusKey?: string }) => FieldProps;
    errors: Record<string, string>;
  };
}) {
  const invalid = Boolean(form.errors.birthday);

  return (
    <>
      <FieldHeading required className="mb-0.5 leading-[22px]">
        When&rsquo;s your birthday?
      </FieldHeading>
      <div className="flex gap-2">
        <Dropdown {...form.field("birthMonth", { focusKey: "birthday" })} label="Month" options={MONTHS} invalid={invalid} />
        <Dropdown {...form.field("birthDay")} label="Day" options={DAYS} invalid={invalid} />
        <Dropdown {...form.field("birthYear")} label="Year" options={YEARS} invalid={invalid} />
      </div>
      <p className="mb-2 ml-2 text-[12px] leading-5 text-[var(--tt-text-muted)]">
        Your birthday won&rsquo;t be shown publicly.
      </p>
    </>
  );
}

"use client";

export const FIELD =
  "h-11 w-full rounded-[4px] border border-transparent bg-white/[0.12] px-3 text-[15px] text-[var(--tt-text)] caret-[var(--tt-red)] outline-none placeholder:text-[rgb(255_255_255/0.34)]";

/**
 * A labelled input wired to `useForm`. Spread a field onto it:
 *   `<TextField {...form.field("title")} label="Title" />`
 *
 * It is a component rather than three inline elements so the field object is
 * never held in a local variable — `ref` in it makes the React Compiler lint
 * read the whole object as a ref, and reading `.value` off one during render is
 * (rightly) an error.
 */
export function TextField({
  label,
  value,
  onChange,
  error,
  ref,
  placeholder,
  maxLength,
  multiline,
}: {
  label: string;
  value: string;
  onChange: (next: string) => void;
  error?: string;
  ref?: React.Ref<HTMLInputElement & HTMLTextAreaElement>;
  placeholder?: string;
  maxLength?: number;
  multiline?: boolean;
}) {
  const className = error ? `${FIELD} border-[var(--tt-red-active)]` : FIELD;
  const shared = {
    ref,
    value,
    maxLength,
    placeholder,
    onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      onChange(event.target.value),
    "aria-invalid": error ? true : undefined,
  } as const;

  const atLimit = maxLength !== undefined && value.length >= maxLength;
  const counterId = maxLength !== undefined ? `${label}-count` : undefined;

  return (
    <Labelled label={label} error={error}>
      {multiline ? (
        <textarea
          {...shared}
          aria-describedby={counterId}
          className={`${className} no-scrollbar h-24 resize-none py-2`}
        />
      ) : (
        <input {...shared} aria-describedby={counterId} className={className} />
      )}
      {maxLength !== undefined && (
        <p
          id={counterId}
          className={`mt-1 text-right text-[13px] leading-[18px] ${
            atLimit
              ? "text-[var(--tt-red-active)]"
              : "text-[var(--tt-text-secondary)]"
          }`}
        >
          {value.length} / {maxLength}
        </p>
      )}
    </Labelled>
  );
}

export function Labelled({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-[15px] leading-[22px] font-semibold text-[var(--tt-text)]">
        {label}
      </span>
      {children}
      {error && (
        <p role="alert" className="mt-1.5 text-[13px] leading-[18px] text-[var(--tt-red-active)]">
          {error}
        </p>
      )}
    </label>
  );
}

"use client";

import { useCallback, useRef, useState } from "react";

import { messageFor } from "@/lib/api/errors";
import { toast } from "@/components/ui/toast";

/**
 * The one form hook. Every form in the app validates through this.
 *
 * The behaviour it implements, which is the whole point of it:
 *
 *  1. **Nothing is validated while the form is being filled in.** Complaining
 *     about an email that is half typed is noise, so the first check happens on
 *     submit.
 *  2. **On submit, every field is checked at once** and each message renders
 *     under its own field — not one line at the bottom saying something is
 *     wrong somewhere above.
 *  3. **The first bad field is focused**, in the order the fields appear on
 *     screen, so the caret is already where the fix has to be typed.
 *  4. **Typing into a field that is showing an error clears it as soon as the
 *     value becomes valid** — and only clears. Typing never *raises* a new
 *     error on a field the reader has not finished with yet.
 *
 * Validation itself is delegated to a schema (see `schemas.ts`); the hook only
 * needs `safeParse`, so it is not tied to any particular zod version — or to
 * zod at all.
 */

export interface ValidationIssue {
  readonly path: readonly PropertyKey[];
  readonly message: string;
}

export interface ValidationSchema {
  safeParse(values: unknown):
    | { success: true }
    | { success: false; error: { issues: readonly ValidationIssue[] } };
}

/** What `onSubmit` gets for reporting failures the schema cannot see. */
export interface SubmitHelpers {
  /** Puts a message under one field and focuses it — e.g. USERNAME_TAKEN. */
  setFieldError: (name: string, message: string) => void;
  /** A message for the form as a whole — e.g. wrong password. */
  setFormError: (message: string | null) => void;
}

type Focusable = { focus: () => void };

export interface UseFormOptions<Values extends Record<string, unknown>> {
  schema: ValidationSchema;
  initialValues: Values;
  onSubmit: (values: Values, helpers: SubmitHelpers) => void | Promise<void>;
  /**
   * Whether an unhandled submit rejection also raises a toast. On by default.
   * Forms whose form-level line is always in view (login, signup) pass `false`
   * so the same error is not said twice.
   */
  errorToast?: boolean;
}

export function useForm<Values extends Record<string, unknown>>({
  schema,
  initialValues,
  onSubmit,
  errorToast = true,
}: UseFormOptions<Values>) {
  const [values, setValues] = useState<Values>(initialValues);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  /**
   * Reads of the current values that must not wait for a re-render: the change
   * handler validates against the value it was just handed, and the submit
   * handler must not send whatever React last rendered.
   */
  const valuesRef = useRef(values);
  const submittingRef = useRef(false);

  /** Field order as rendered, which is the order errors are focused in. */
  const order = useRef<string[]>([]);
  const nodes = useRef(new Map<string, Focusable>());

  const validate = useCallback(
    (candidate: Values): Record<string, string> => {
      const result = schema.safeParse(candidate);
      if (result.success) return {};

      const found: Record<string, string> = {};
      for (const issue of result.error.issues) {
        const key = String(issue.path[0] ?? "");
        // First issue wins: the rules are written most-important-first, and a
        // field shows one line, not a stack of them.
        if (key && !(key in found)) found[key] = issue.message;
      }
      return found;
    },
    [schema],
  );

  const focusField = useCallback((name: string) => {
    nodes.current.get(name)?.focus();
  }, []);

  const setValue = useCallback(
    (name: string, value: unknown) => {
      const next = { ...valuesRef.current, [name]: value } as Values;
      valuesRef.current = next;
      setValues(next);

      setErrors((current) => {
        if (Object.keys(current).length === 0) return current;

        const fresh = validate(next);
        let changed = false;
        const pruned: Record<string, string> = {};

        for (const key of Object.keys(current)) {
          /**
           * Only fields that are *already* showing a message are touched, so
           * typing never raises a complaint about a field the reader has not
           * finished with. A field that still fails keeps a message, but the
           * current one: filling in all three birthday selects turns "Select
           * your birthday" into the age rule rather than leaving a line that
           * no longer describes what is wrong.
           */
          if (fresh[key]) pruned[key] = fresh[key];
          else changed = true;

          if (fresh[key] !== current[key]) changed = true;
        }

        return changed ? pruned : current;
      });
    },
    [validate],
  );

  const setFieldError = useCallback(
    (name: string, message: string) => {
      setErrors((current) => ({ ...current, [name]: message }));
      focusField(name);
    },
    [focusField],
  );

  const handleSubmit = useCallback(
    async (event?: { preventDefault: () => void }) => {
      event?.preventDefault();
      if (submittingRef.current) return;

      setFormError(null);

      const found = validate(valuesRef.current);
      setErrors(found);

      const firstBad = order.current.find((name) => found[name]);
      if (firstBad) {
        focusField(firstBad);
        return;
      }

      submittingRef.current = true;
      setSubmitting(true);
      try {
        await onSubmit(valuesRef.current, { setFieldError, setFormError });
      } catch (cause) {
        // A rejected submit that the caller did not want to handle itself. The
        // copy is the app's, never the backend's `message` field. Shown inline
        // (under the form) and, unless `errorToast` is off, as a toast too so it
        // registers even when the form-level line is scrolled out of view.
        const message = messageFor(cause);
        setFormError(message);
        if (errorToast) toast.error(message);
      } finally {
        submittingRef.current = false;
        setSubmitting(false);
      }
    },
    [errorToast, focusField, onSubmit, setFieldError, validate],
  );

  /**
   * Wires one field. Spread onto an input:
   *   `<AuthInput {...form.field("email")} placeholder="Email address" />`
   *
   * `focusKey` is for fields whose error belongs to a group — the three
   * birthday selects share the `birthday` error, and the Month select claims
   * the focus for it.
   */
  const field = useCallback(
    (name: string, options?: { focusKey?: string }) => {
      if (!order.current.includes(name)) order.current.push(name);

      const errorKey = options?.focusKey ?? name;
      if (options?.focusKey && !order.current.includes(options.focusKey)) {
        // The group's error must be focusable in the position of its first
        // field, otherwise "focus the first error" skips over it.
        order.current.splice(order.current.indexOf(name), 0, options.focusKey);
      }

      return {
        name,
        value: (valuesRef.current[name] ?? "") as string,
        error: errors[errorKey],
        onChange: (next: string) => setValue(name, next),
        ref: (node: Focusable | null) => {
          if (node) nodes.current.set(errorKey, node);
          else nodes.current.delete(errorKey);
        },
      };
    },
    [errors, setValue],
  );

  const reset = useCallback((next: Values) => {
    valuesRef.current = next;
    setValues(next);
    setErrors({});
    setFormError(null);
  }, []);

  return {
    values,
    errors,
    formError,
    submitting,
    field,
    setValue,
    setFieldError,
    setFormError,
    handleSubmit,
    reset,
    /** True when a field is currently showing a message. */
    get hasErrors() {
      return Object.keys(errors).length > 0;
    },
  };
}

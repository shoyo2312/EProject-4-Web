import { z } from "zod";

import { codePointLength } from "@/lib/code-points";
import { keywordKey } from "@/lib/comments/keyword-key";

/**
 * Every field rule the app enforces, in one place.
 *
 * Two audiences have to agree here: the person typing, and the server. A rule
 * that is stricter than the backend only annoys; a rule that is *looser* lets
 * the request through and turns a field-level message into a generic red line
 * under the form. So the limits below mirror auth-service's DTO validation
 * (username 3–50, password 8–100, title 150…) and only add what the server
 * cannot express — the age gate, and the "a username is not an email" rule.
 */

/**
 * Deliberately not the RFC grammar: it accepts one @, something either side,
 * and a dot in the domain. Anything narrower rejects real addresses; anything
 * wider is what the server is for.
 */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export const emailField = z
  .string()
  .trim()
  .min(1, "Enter your email address.")
  .regex(EMAIL_RE, "That doesn’t look like an email address — try name@example.com.");

/**
 * Lowercase handles only. The `@` check comes first and has its own wording
 * because typing an email into the username box is the mistake people actually
 * make on this form, and "use lowercase letters and numbers" does not explain
 * what is wrong with `me@gmail.com`.
 */
export const usernameField = z
  .string()
  .trim()
  .min(1, "Enter a username.")
  .superRefine((value, ctx) => {
    const fail = (message: string) =>
      ctx.addIssue({ code: "custom", message });

    if (value.includes("@")) {
      return fail("A username isn’t an email address — leave out the “@”.");
    }
    if (/\s/.test(value)) return fail("Usernames can’t contain spaces.");
    if (value !== value.toLowerCase()) {
      return fail("Usernames are lowercase only.");
    }
    if (value.length < 3) return fail("Usernames need at least 3 characters.");
    if (value.length > 50) return fail("Usernames can be at most 50 characters.");
    if (!/^[a-z]/.test(value)) return fail("Usernames must start with a letter.");
    if (!/^[a-z0-9._]+$/.test(value)) {
      return fail("Use lowercase letters, numbers, underscores and periods only.");
    }
  });

/**
 * One missing requirement at a time, in the order people fix them. A single
 * "must contain upper, lower, number and symbol" line makes the reader diff
 * their own password against a checklist; this just says what to add next.
 */
export const strongPasswordField = z
  .string()
  .min(1, "Enter a password.")
  .superRefine((value, ctx) => {
    const fail = (message: string) =>
      ctx.addIssue({ code: "custom", message });

    if (value.length < 8) return fail("Use at least 8 characters.");
    if (value.length > 100) return fail("Passwords can be at most 100 characters.");
    if (!/[a-z]/.test(value)) return fail("Add a lowercase letter.");
    if (!/[A-Z]/.test(value)) return fail("Add an uppercase letter.");
    if (!/[0-9]/.test(value)) return fail("Add a number.");
    if (!/[^A-Za-z0-9]/.test(value)) {
      return fail("Add a special character, like ! ? # or @.");
    }
  });

/* --- login ---------------------------------------------------------------- */

/**
 * Login checks shape, not strength. The account was created under whatever
 * rules were in force at the time, and a strength rule applied at *login* would
 * lock people out of accounts whose password is merely old — the server is the
 * only thing that can say whether these credentials are right.
 */
export const loginSchema = z.object({
  identifier: z
    .string()
    .trim()
    .min(1, "Enter your email address or username.")
    .refine((value) => !/\s/.test(value), "This can’t contain spaces.")
    .refine(
      (value) => !value.includes("@") || EMAIL_RE.test(value),
      "That doesn’t look like an email address — try name@example.com.",
    ),
  password: z.string().min(1, "Enter your password."),
});

/* --- signup --------------------------------------------------------------- */

export const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;

export const MINIMUM_AGE = 18;

/**
 * The three birthday selects validate as one field: an error belongs under the
 * row, not under whichever select happens to be empty. `birthday` is therefore
 * an error key with no value of its own — the form points it at the Month
 * select so focusing it lands somewhere sensible.
 */
const birthdayFields = {
  birthMonth: z.string(),
  birthDay: z.string(),
  birthYear: z.string(),
};

/**
 * Signup asks one screen at a time — birthday and email, then the password,
 * then the username — so each screen validates only what is on it.
 */
export const signupDetailsSchema = z
  .object({ ...birthdayFields, email: emailField })
  .superRefine(checkBirthday);

export const passwordSchema = z.object({ password: strongPasswordField });

export const usernameSchema = z.object({ username: usernameField });

function checkBirthday(
  values: { birthMonth: string; birthDay: string; birthYear: string },
  ctx: z.RefinementCtx,
) {
  const fail = (message: string) =>
    ctx.addIssue({ code: "custom", path: ["birthday"], message });

  if (!values.birthMonth || !values.birthDay || !values.birthYear) {
    return fail("Select your birthday.");
  }

  const month = MONTHS.indexOf(values.birthMonth as (typeof MONTHS)[number]);
  const day = Number(values.birthDay);
  const year = Number(values.birthYear);
  const birthday = new Date(year, month, day);

  // `new Date(2009, 1, 31)` silently becomes 3 March. Reading the parts back
  // is the only way to catch a day the chosen month does not have.
  if (
    birthday.getFullYear() !== year ||
    birthday.getMonth() !== month ||
    birthday.getDate() !== day
  ) {
    return fail("That date doesn’t exist — check the day.");
  }

  if (birthday > new Date()) return fail("That date is in the future.");
  if (ageOn(birthday, new Date()) < MINIMUM_AGE) {
    return fail(`You need to be at least ${MINIMUM_AGE} to sign up.`);
  }
}

/** Whole years elapsed — the month/day comparison is what makes it exact. */
function ageOn(birthday: Date, today: Date): number {
  let age = today.getFullYear() - birthday.getFullYear();
  const monthDelta = today.getMonth() - birthday.getMonth();
  if (monthDelta < 0 || (monthDelta === 0 && today.getDate() < birthday.getDate())) {
    age -= 1;
  }
  return age;
}

/* --- the rest of the forms ------------------------------------------------ */

/** An address on its own: where a reset code goes, or one a social account adds. */
export const emailSchema = z.object({ email: emailField });

/**
 * The file itself is not validated here: it is picked, not typed, so its type
 * and size are checked where it is chosen and the URL is whatever the upload
 * came back with. What is left is the metadata, and the limits mirror
 * video-service's DTO — in code points, as `@MaxCodePoints` counts.
 */
export const uploadSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, "Give the video a title.")
    .refine((value) => codePointLength(value) <= 150, "Titles can be at most 150 characters."),
  description: z
    .string()
    .trim()
    .refine(
      (value) => codePointLength(value) <= 2000,
      "Descriptions can be at most 2000 characters.",
    ),
  visibility: z.enum(["PUBLIC", "PRIVATE"]),
});

const editProfileSchema = z.object({
  username: usernameField,
  nickname: z
    .string()
    .trim()
    .min(1, "Enter a name.")
    .max(30, "Names can be at most 30 characters."),
  bio: z.string().max(80, "Bios can be at most 80 characters."),
  avatarUrl: z
    .string()
    .trim()
    .refine(
      (value) => value === "" || /^(https:\/\/|blob:|\/)/.test(value),
      "The avatar must be an https URL.",
    ),
});

/**
 * The Edit profile form for an account whose handle is `currentUsername`. The
 * handle is held to the rule only once it is edited: one from before the rule
 * — a generated handle can start with a digit — is the owner's to keep, and
 * must not stop them saving a new bio.
 */
export function editProfileSchemaFor(currentUsername: string) {
  return editProfileSchema.extend({
    username: z.string().superRefine((value, ctx) => {
      if (value.trim() === currentUsername) return;

      const result = usernameField.safeParse(value);
      if (result.success) return;
      for (const issue of result.error.issues) {
        ctx.addIssue({ code: "custom", message: issue.message });
      }
    }),
  });
}

/** user-service's cap on `commentKeywords`. */
export const COMMENT_KEYWORDS_MAX = 50;

/**
 * `/setting` → Comment filters: one more keyword for `existing`. Mirrors
 * user-service — 1–30 code points with a letter or digit in them, 50 at most.
 * The server drops a repeat without a word, so a repeat is caught here instead.
 */
export function commentKeywordSchemaFor(existing: readonly string[]) {
  const taken = new Set(existing.map(keywordKey));
  return z.object({
    keyword: z
      .string()
      .trim()
      .min(1, "Enter a keyword.")
      .refine((value) => codePointLength(value) <= 30, "Keywords can be at most 30 characters.")
      .refine((value) => keywordKey(value) !== "", "Keywords need a letter or a number.")
      .refine((value) => !taken.has(keywordKey(value)), "You already filter this keyword.")
      .refine(
        () => existing.length < COMMENT_KEYWORDS_MAX,
        `You can filter up to ${COMMENT_KEYWORDS_MAX} keywords.`,
      ),
  });
}

/**
 * `/setting` → Sleep hours: two `<input type="time">` values, already the
 * server's "HH:mm". Mirrors user-service — both ends, and not the same minute.
 * Start after end is not an error: that is a night crossing midnight.
 */
export const sleepHoursSchema = z
  .object({
    start: z.string().min(1, "Choose a start time."),
    end: z.string().min(1, "Choose an end time."),
  })
  .refine((values) => values.start !== values.end, {
    path: ["end"],
    message: "Start and end can’t be the same time.",
  });

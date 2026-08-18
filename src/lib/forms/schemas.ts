import { z } from "zod";

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

/** Six digits. The field itself already strips everything else. */
export const otpField = z
  .string()
  .trim()
  .min(1, "Enter the 6-digit code.")
  .regex(/^\d{6}$/, "The code is 6 digits.");

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

export type LoginValues = z.infer<typeof loginSchema>;

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
export const signupSchema = z
  .object({
    birthMonth: z.string(),
    birthDay: z.string(),
    birthYear: z.string(),
    email: emailField,
    username: usernameField,
    password: strongPasswordField,
  })
  .superRefine((values, ctx) => {
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
  });

export type SignupValues = z.infer<typeof signupSchema>;

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

export const verifyEmailSchema = z.object({
  email: emailField,
  otp: otpField,
});

export const forgotPasswordSchema = z.object({ email: emailField });

/** `/signup/add-email` — the address a social account is claiming. */
export const addEmailSchema = z.object({ email: emailField });

/** The new password is being *set*, so the full strength rule applies. */
export const resetPasswordSchema = z.object({
  otp: otpField,
  password: strongPasswordField,
});

/**
 * video-service allow-lists the media URL — `https` on a configured CDN host or
 * `s3://` on a configured bucket. The scheme is the half the client can check
 * without knowing the deployment's host list; the host itself stays the
 * server's call, and comes back as a form-level error.
 */
export const uploadSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, "Give the video a title.")
    .max(150, "Titles can be at most 150 characters."),
  description: z
    .string()
    .trim()
    .max(2000, "Descriptions can be at most 2000 characters."),
  rawFileUrl: z
    .string()
    .trim()
    .min(1, "Paste the URL of the media file.")
    .refine(
      (value) => value.startsWith("https://") || value.startsWith("s3://"),
      "The URL must start with https:// or s3://.",
    ),
  visibility: z.enum(["PUBLIC", "PRIVATE"]),
});

export const editProfileSchema = z.object({
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

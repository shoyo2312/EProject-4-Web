/**
 * The checklist under the signup modal's password field, ticked off live as
 * the password is typed. The rules are `strongPasswordField`'s, grouped into
 * the live modal's two-line shape plus one line for the case rule TikTok does
 * not have — a password that ticks every line here is one the schema accepts.
 */
export interface PasswordRule {
  label: string;
  met: boolean;
}

export function passwordRules(value: string): PasswordRule[] {
  return [
    {
      label: "8 to 100 characters",
      met: value.length >= 8 && value.length <= 100,
    },
    {
      label: "Uppercase and lowercase letters",
      met: /[a-z]/.test(value) && /[A-Z]/.test(value),
    },
    {
      label: "Numbers and special characters",
      met: /[0-9]/.test(value) && /[^A-Za-z0-9]/.test(value),
    },
  ];
}

export function meetsPasswordRules(value: string): boolean {
  return passwordRules(value).every((rule) => rule.met);
}

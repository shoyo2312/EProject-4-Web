import { redirect } from "next/navigation";

/**
 * The live site treats this segment as a prefix only — landing on it forwards
 * to the phone form, which is the default method.
 */
export default function SignupPhoneOrEmail() {
  redirect("/signup/phone-or-email/phone");
}

import type { Metadata } from "next";

import { SignupPage } from "@/components/auth/SignupPage";
import { getSignupOptions } from "@/lib/data";

export const metadata: Metadata = { title: "Sign up | TikTok" };

export default async function SignupWithPhone() {
  return <SignupPage step="phone" options={await getSignupOptions()} />;
}

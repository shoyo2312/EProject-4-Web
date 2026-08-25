import type { Metadata } from "next";

import { SignupPage } from "@/components/auth/SignupPage";
import { getSignupOptions } from "@/lib/data";

export const metadata: Metadata = { title: "Sign up | Nowa" };

export default async function SignupWithEmail() {
  return <SignupPage step="email" options={await getSignupOptions()} />;
}

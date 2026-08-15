import type { Metadata } from "next";

import { LoginPage } from "@/components/auth/LoginPage";
import { getLoginPageOptions } from "@/lib/data";

export const metadata: Metadata = { title: "Log in | TikTok" };

export default async function LoginWithEmail() {
  return <LoginPage step="email" options={await getLoginPageOptions()} />;
}

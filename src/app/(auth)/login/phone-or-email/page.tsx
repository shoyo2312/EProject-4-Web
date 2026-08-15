import type { Metadata } from "next";

import { LoginPage } from "@/components/auth/LoginPage";
import { getLoginPageOptions } from "@/lib/data";

export const metadata: Metadata = { title: "Log in | TikTok" };

export default async function LoginWithPhone() {
  return <LoginPage step="phone" options={await getLoginPageOptions()} />;
}

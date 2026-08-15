import type { Metadata } from "next";

import { LoginPage } from "@/components/auth/LoginPage";
import { getLoginPageOptions } from "@/lib/data";

export const metadata: Metadata = { title: "Log in | TikTok" };

export default async function Login() {
  return <LoginPage step="options" options={await getLoginPageOptions()} />;
}

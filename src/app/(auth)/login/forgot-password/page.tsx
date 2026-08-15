import type { Metadata } from "next";

import { ForgotPasswordPage } from "@/components/auth/ForgotPasswordPage";

export const metadata: Metadata = { title: "Reset password | TikTok" };

export default function ForgotPasswordRoute() {
  return <ForgotPasswordPage />;
}

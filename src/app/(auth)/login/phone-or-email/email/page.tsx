import type { Metadata } from "next";
import { Suspense } from "react";

import { LoginPage } from "@/components/auth/LoginPage";
import { getLoginPageOptions } from "@/lib/data";

export const metadata: Metadata = { title: "Log in | TikTok" };

/**
 * Wrapped in Suspense because this step reads `?verified=1` out of the query
 * string — the OTP screen sets it on its way here — which opts the subtree
 * into client-side rendering.
 */
export default async function LoginWithEmail() {
  return (
    <Suspense fallback={null}>
      <LoginPage step="email" options={await getLoginPageOptions()} />
    </Suspense>
  );
}

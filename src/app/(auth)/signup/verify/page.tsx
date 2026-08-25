import type { Metadata } from "next";
import { Suspense } from "react";

import { VerifyEmailPage } from "@/components/auth/VerifyEmailPage";

export const metadata: Metadata = { title: "Verify your email | Nowa" };

/**
 * The OTP step. Wrapped in Suspense because the page reads the address out of
 * the query string, which opts it into client-side rendering.
 */
export default function VerifyEmailRoute() {
  return (
    <Suspense fallback={null}>
      <VerifyEmailPage />
    </Suspense>
  );
}

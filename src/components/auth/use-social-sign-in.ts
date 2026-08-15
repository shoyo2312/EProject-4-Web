"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { useSession } from "@/components/session/SessionProvider";
import { messageFor } from "@/lib/api/errors";
import {
  isSocialAuthError,
  isSocialCancellation,
  preloadSocialSdks,
  type SocialProvider,
} from "@/lib/auth/social";
import type { LoginOption } from "@/types/tiktok";

/**
 * What every option list does when a row is clicked, in one place: the three
 * lists (login page, signup page, login modal) are laid out differently but
 * behave identically, and the behaviour is the fiddly part.
 *
 * A row with a `provider` runs that provider's SDK and signs in; every other
 * row still falls through to `onFallback`, which is the email flow.
 */
export function useSocialSignIn({
  onFallback,
  redirectTo,
}: {
  /** Rows with no provider behind them — QR, phone/email, LINE, Kakao, Apple. */
  onFallback: (option: LoginOption) => void;
  /**
   * Where a successful social login lands. Omitted inside the modal, which
   * just closes and leaves the viewer where they were.
   */
  redirectTo?: string;
}) {
  const { signInWithProvider } = useSession();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<SocialProvider | null>(null);

  // Loaded up front so the click handler can open the provider's popup without
  // waiting on a script — a popup that arrives late is a blocked popup.
  useEffect(() => preloadSocialSdks(), []);

  const select = useCallback(
    async (option: LoginOption) => {
      if (!option.provider) {
        onFallback(option);
        return;
      }

      setError(null);
      setPending(option.provider);
      try {
        await signInWithProvider(option.provider);
        if (redirectTo) router.push(redirectTo);
      } catch (cause) {
        // Closing the provider's dialog is a decision, not a failure.
        if (isSocialCancellation(cause)) return;
        setError(isSocialAuthError(cause) ? cause.message : messageFor(cause));
      } finally {
        setPending(null);
      }
    },
    [onFallback, redirectTo, router, signInWithProvider],
  );

  return { select, error, pending };
}

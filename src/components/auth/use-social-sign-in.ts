"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { useSession } from "@/components/session/SessionProvider";
import { isApiError, messageFor } from "@/lib/api/errors";
import {
  getProviderToken,
  isSocialAuthError,
  isSocialCancellation,
  preloadSocialSdks,
  type SocialProvider,
} from "@/lib/auth/social";
import type { LoginOption } from "@/types/tiktok";

/** Where a social login lands when the account has no email address yet. */
const ADD_EMAIL_HREF = "/signup/add-email";

/**
 * A login that stopped halfway: the provider account is new to us, but its
 * address already belongs to an account here and the provider does not vouch
 * for it. The server has mailed a code; the provider token is kept so the
 * confirmation can present it again, which is what proves the other half.
 *
 * React state only, never storage. It is a short-lived credential, and the flow
 * it belongs to does not survive a reload anyway.
 */
export interface SocialLinkChallenge {
  provider: SocialProvider;
  token: string;
}

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
  const { signInWithProvider, confirmSocialLink } = useSession();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<SocialProvider | null>(null);
  const [challenge, setChallenge] = useState<SocialLinkChallenge | null>(null);

  // Loaded up front so the click handler can open the provider's popup without
  // waiting on a script — a popup that arrives late is a blocked popup.
  useEffect(() => preloadSocialSdks(), []);

  /** One landing rule for both halves of the flow. */
  const land = useCallback(
    (requiresEmail: boolean) => {
      if (requiresEmail) router.push(ADD_EMAIL_HREF);
      else if (redirectTo) router.push(redirectTo);
    },
    [redirectTo, router],
  );

  const select = useCallback(
    async (option: LoginOption) => {
      if (!option.provider) {
        onFallback(option);
        return;
      }

      const provider = option.provider;
      setError(null);
      setPending(provider);

      let token: string;
      try {
        // The provider's dialog must open inside the click that started this,
        // so this is awaited before anything slower.
        token = await getProviderToken(provider);
      } catch (cause) {
        // Closing the provider's dialog is a decision, not a failure.
        if (!isSocialCancellation(cause)) {
          setError(isSocialAuthError(cause) ? cause.message : messageFor(cause));
        }
        setPending(null);
        return;
      }

      try {
        const { requiresEmail } = await signInWithProvider(provider, token);
        land(requiresEmail);
      } catch (cause) {
        // Not an error either: the account exists, and has to prove the mailbox
        // is theirs before the two are merged.
        if (isApiError(cause) && cause.is("SOCIAL_LINK_VERIFICATION_REQUIRED")) {
          setChallenge({ provider, token });
          return;
        }
        setError(messageFor(cause));
      } finally {
        setPending(null);
      }
    },
    [land, onFallback, signInWithProvider],
  );

  /**
   * Spends the mailed code. A wrong one is reported without dropping the
   * challenge — the viewer retypes it, and the server counts the guesses.
   */
  const confirm = useCallback(
    async (otp: string) => {
      if (!challenge) return;

      setError(null);
      setPending(challenge.provider);
      try {
        const { requiresEmail } = await confirmSocialLink(challenge.provider, {
          token: challenge.token,
          otp,
        });
        setChallenge(null);
        land(requiresEmail);
      } catch (cause) {
        setError(messageFor(cause));
      } finally {
        setPending(null);
      }
    },
    [challenge, confirmSocialLink, land],
  );

  const cancel = useCallback(() => {
    setChallenge(null);
    setError(null);
  }, []);

  return { select, confirm, cancel, challenge, error, pending };
}

"use client";

import { useCallback, useEffect, useState } from "react";

import { useSession } from "@/components/session/SessionProvider";
import { toast } from "@/components/ui/toast";
import { closedAccountKind, isApiError, messageFor } from "@/lib/api/errors";
import {
  getProviderToken,
  isSocialAuthError,
  isSocialCancellation,
  preloadSocialSdks,
  type SocialProvider,
} from "@/lib/auth/social";
import type { LoginOption } from "@/types/tiktok";

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
 * A provider sign-in that vouched for an account its owner closed. The token
 * is kept, like a link challenge's, so reopening sends it back rather than
 * opening the provider's dialog a second time.
 */
export interface ClosedAccountSignIn extends SocialLinkChallenge {
  deletionPending: boolean;
}

/**
 * What a row of the modal's option list does when clicked, kept apart from the
 * list itself: the login and signup lists behave identically, and the
 * behaviour is the fiddly part.
 *
 * A row with a `provider` runs that provider's SDK and signs in; every other
 * row still falls through to `onFallback`, which is the email flow.
 */
export function useSocialSignIn({
  onFallback,
  onEmailMissing,
  onAccountClosed,
}: {
  /** Rows with no provider behind them — QR, phone/email, LINE, Kakao, Apple. */
  onFallback: (option: LoginOption) => void;
  /**
   * Signed in, but the account has no address — the provider gave none. The
   * session leaves the modal open for this, so it can ask for one.
   */
  onEmailMissing: () => void;
  /** The account is one its owner closed; `reactivate` reopens it. */
  onAccountClosed: (signIn: ClosedAccountSignIn) => void;
}) {
  const { signInWithProvider, confirmSocialLink } = useSession();
  const [pending, setPending] = useState<SocialProvider | null>(null);
  const [challenge, setChallenge] = useState<SocialLinkChallenge | null>(null);

  // Loaded up front so the click handler can open the provider's popup without
  // waiting on a script — a popup that arrives late is a blocked popup.
  useEffect(() => preloadSocialSdks(), []);

  /**
   * Everything after a provider token is in hand: trade it for our session, or
   * fall into the mail-a-code link challenge.
   */
  const completeSignIn = useCallback(
    async (provider: SocialProvider, token: string) => {
      setPending(provider);
      try {
        const { requiresEmail } = await signInWithProvider(provider, token);
        if (requiresEmail) onEmailMissing();
      } catch (cause) {
        // Not an error: the account exists, and has to prove the mailbox is
        // theirs before the two are merged.
        if (isApiError(cause) && cause.is("SOCIAL_LINK_VERIFICATION_REQUIRED")) {
          setChallenge({ provider, token });
          return;
        }
        const closed = closedAccountKind(cause);
        if (closed) {
          onAccountClosed({ provider, token, deletionPending: closed === "deletion-pending" });
          return;
        }
        toast.error(messageFor(cause));
      } finally {
        setPending(null);
      }
    },
    [onAccountClosed, onEmailMissing, signInWithProvider],
  );

  /** Signs in with the kept token again, this time reopening the account. */
  const reactivate = useCallback(
    async ({ provider, token }: SocialLinkChallenge) => {
      setPending(provider);
      try {
        const { requiresEmail } = await signInWithProvider(provider, token, { reactivate: true });
        if (requiresEmail) onEmailMissing();
      } catch (cause) {
        toast.error(messageFor(cause));
      } finally {
        setPending(null);
      }
    },
    [onEmailMissing, signInWithProvider],
  );

  const select = useCallback(
    async (option: LoginOption) => {
      if (!option.provider) {
        onFallback(option);
        return;
      }

      const provider = option.provider;
      setPending(provider);

      let token: string;
      try {
        // The provider's dialog must open inside the click that started this,
        // so this is awaited before anything slower.
        token = await getProviderToken(provider);
      } catch (cause) {
        // Closing the provider's dialog is a decision, not a failure.
        if (!isSocialCancellation(cause)) {
          toast.error(isSocialAuthError(cause) ? cause.message : messageFor(cause));
        }
        setPending(null);
        return;
      }

      await completeSignIn(provider, token);
    },
    [completeSignIn, onFallback],
  );

  /**
   * Spends the mailed code. A wrong one is reported without dropping the
   * challenge — the viewer retypes it, and the server counts the guesses.
   */
  const confirm = useCallback(
    async (otp: string) => {
      if (!challenge) return;

      setPending(challenge.provider);
      try {
        const { requiresEmail } = await confirmSocialLink(challenge.provider, {
          token: challenge.token,
          otp,
        });
        setChallenge(null);
        if (requiresEmail) onEmailMissing();
      } catch (cause) {
        // The link is confirmed by now; it is the account that is closed.
        const closed = closedAccountKind(cause);
        if (closed) {
          setChallenge(null);
          onAccountClosed({ ...challenge, deletionPending: closed === "deletion-pending" });
          return;
        }
        toast.error(messageFor(cause));
      } finally {
        setPending(null);
      }
    },
    [challenge, confirmSocialLink, onAccountClosed, onEmailMissing],
  );

  const cancel = useCallback(() => {
    setChallenge(null);
  }, []);

  return { select, confirm, cancel, reactivate, challenge, pending };
}

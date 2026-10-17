"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/navigation";

import { AuthModal } from "@/components/session/AuthModal";
import { LogoutConfirmModal } from "@/components/session/LogoutConfirmModal";
import { MODAL_EXIT_MS } from "@/components/ui/modal";
import { toast } from "@/components/ui/toast";
import { usePresence } from "@/hooks/use-presence";
import { authorFromMe } from "@/lib/api/adapters";
import { clearAuthorCache } from "@/lib/api/authors";
import { clearRepostContextCache } from "@/lib/repost-context";
import { clearCommentCache } from "@/lib/comment-cache";
import { resetRealtime } from "@/lib/realtime/stompClient";
import * as authApi from "@/lib/api/auth";
import { isApiError } from "@/lib/api/errors";
import { getAccessToken, getRefreshToken, onSessionEnded } from "@/lib/api/tokens";
import { linkedProviders } from "@/lib/account/closure";
import { awaitProfile } from "@/lib/auth/await-profile";
import type { SocialProvider } from "@/lib/auth/social";
import * as usersApi from "@/lib/api/users";
import type { MeResponse } from "@/lib/api/types";
import type { Author, LoginOption } from "@/types/tiktok";

/** The viewer: an `Author` for rendering, plus what only the account knows. */
export interface SessionUser extends Author {
  userId: string;
  /** Null for a social account the provider gave no address for — see
   *  `requiresEmail` and the modal's add-email step. */
  email: string | null;
  bio: string;
  followerCount: number;
  followingCount: number;
  /**
   * False while user-service has not consumed the registration event yet, so
   * the social half of the profile is still missing. Kafka makes this
   * eventual; it usually resolves in a few hundred milliseconds.
   */
  profileReady: boolean;
  /** When the handle may change again (once every 30 days); null when it may now. */
  usernameChangeableAt: string | null;
  /** When the nickname may change again (once every 7 days); null when it may now. */
  nicknameChangeableAt: string | null;
  /** False for a social account that has never set a password. */
  hasPassword: boolean;
  /** With `hasPassword` and `providers`, how the owner reconfirms before closing the account. */
  emailVerified: boolean;
  providers: SocialProvider[];
}

interface SessionValue {
  user: SessionUser | null;
  isSignedIn: boolean;
  /** True until the first `/me` settles — the UI is not "signed out" yet. */
  isLoading: boolean;

  /**
   * Gate for an action that needs an account (liking, following, commenting).
   * Returns true when the caller may proceed; otherwise opens the login modal,
   * exactly as the live site does, and returns false.
   */
  requireSignIn: () => boolean;
  openLogin: () => void;

  /**
   * Real login. Throws `ApiError` so the form can branch on `code`. `quiet`
   * skips the "logged in" toast, for a caller signing back in after a change
   * of its own that it announces itself. `reactivate` reopens an account its
   * owner closed, after a sign-in without it was refused for that.
   */
  signIn: (
    usernameOrEmail: string,
    password: string,
    options?: { quiet?: boolean; reactivate?: boolean },
  ) => Promise<void>;
  /**
   * Last step of the email-first signup: creates the account for the address
   * the ticket proved and signs it in. Throws `ApiError` like `signIn`.
   */
  signUp: (input: {
    signupToken: string;
    username: string;
    password: string;
  }) => Promise<void>;
  /**
   * Trades a token the provider's SDK already issued for a session of ours.
   * Signs up on first use — the backend has one endpoint for both.
   *
   * The token is passed in rather than fetched here so the caller still holds
   * it if this throws 409 `SOCIAL_LINK_VERIFICATION_REQUIRED`, which is not a
   * message to show but a code to collect and hand to `confirmSocialLink`.
   *
   * `requiresEmail` means the account has no address at all — the provider
   * gave none. The modal stays open then, and asks for one next.
   */
  signInWithProvider: (
    provider: SocialProvider,
    providerToken: string,
    options?: { reactivate?: boolean },
  ) => Promise<{ requiresEmail: boolean }>;
  /** Second half of that 409: the same provider token, plus the mailed code. */
  confirmSocialLink: (
    provider: SocialProvider,
    input: { token: string; otp: string },
  ) => Promise<{ requiresEmail: boolean }>;
  /** `quiet` skips the "logged out" toast, for a caller that says why itself. */
  signOut: (options?: { quiet?: boolean }) => Promise<void>;
  /** Asks "Are you sure you want to log out?" first, as the live menu does. */
  confirmSignOut: () => void;
  /** Re-reads `/me`; call after anything that changes the profile server-side. */
  reload: () => Promise<void>;
  /**
   * Saves a profile edit through `PATCH /users/me` and folds the result back
   * into the session, so the sidebar and top bar repaint at once.
   */
  updateProfile: (patch: {
    displayName?: string;
    bio?: string;
    avatarUrl?: string;
  }) => Promise<void>;
  /** Local-only patch, for optimistic UI that a request will confirm. */
  updateUser: (patch: Partial<SessionUser>) => void;
}

const SessionContext = createContext<SessionValue | null>(null);

export function useSession(): SessionValue {
  const value = useContext(SessionContext);
  if (!value) throw new Error("useSession must be used inside <SessionProvider>");
  return value;
}

function toSessionUser(me: MeResponse): SessionUser {
  return {
    ...authorFromMe(me),
    userId: me.id,
    email: me.email,
    bio: me.bio ?? "",
    followerCount: me.followerCount ?? 0,
    followingCount: me.followingCount ?? 0,
    profileReady: me.profileReady,
    usernameChangeableAt: me.usernameChangeableAt ?? null,
    nicknameChangeableAt: me.displayNameChangeableAt ?? null,
    hasPassword: me.hasPassword ?? true,
    emailVerified: me.emailVerified ?? me.email !== null,
    providers: linkedProviders(me.providers),
  };
}

/**
 * Forgets everything cached on behalf of the previous viewer — or of nobody:
 * authors resolved while signed out are placeholders, and `likedByMe`, the
 * follow cache and the socket's `/user/**` identity are all per viewer.
 */
function resetViewerState(): void {
  clearAuthorCache();
  clearCommentCache();
  clearRepostContextCache();
  usersApi.clearFollowCache();
  resetRealtime();
}

/**
 * Owns who the viewer is, and the login modal in front of everything they
 * cannot do while signed out.
 *
 * The session is established in the browser, not on the server: the JWT pair
 * lives in `localStorage`, so the first paint is always the signed-out shell
 * and `/me` fills it in on mount. `isLoading` exists so the sidebar can avoid
 * flashing a "Log in" button at somebody who is, in fact, logged in.
 */
export function SessionProvider({
  loginOptions,
  signupOptions,
  children,
}: {
  loginOptions: LoginOption[];
  signupOptions: LoginOption[];
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [user, setUser] = useState<SessionUser | null>(null);
  const [isLoading, setLoading] = useState(true);
  const [loginOpen, setLoginOpen] = useState(false);
  // Every close plays the way out, including the one a sign-in makes.
  const loginModal = usePresence(loginOpen, MODAL_EXIT_MS);
  // Here rather than beside the menu that opens it, which unmounts with the
  // session — this has to outlive the logout to finish closing.
  const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false);
  const logoutConfirm = usePresence(logoutConfirmOpen, MODAL_EXIT_MS);

  const openLogin = useCallback(() => setLoginOpen(true), []);

  const loadMe = useCallback(async () => {
    const me = await authApi.getMe();
    setUser(toSessionUser(me));
  }, []);

  /**
   * Bootstrap. A missing access token with a live refresh token is the normal
   * state after the 15-minute expiry, so the client's own refresh path handles
   * it: `apiFetch` sees the 401, refreshes once, replays once.
   */
  const bootstrapped = useRef(false);
  useEffect(() => {
    if (bootstrapped.current) return;
    bootstrapped.current = true;

    // Async even in the no-token case, so the first paint is always the
    // server's signed-out markup and hydration has nothing to disagree with.
    (async () => {
      try {
        if (getAccessToken() || getRefreshToken()) await loadMe();
      } catch {
        setUser(null);
      } finally {
        setLoading(false);
      }
    })();
  }, [loadMe]);

  /**
   * The server can end a session without being asked — a password reset, or
   * replay detection deciding a refresh token was stolen. Both surface as a
   * failed refresh, which clears the tokens and fires this.
   */
  useEffect(
    () =>
      onSessionEnded(() => {
        resetViewerState();
        setUser(null);
        setLoading(false);
      }),
    [],
  );

  /**
   * A profile that was not ready at login (Kafka still catching up) is retried
   * a couple of times rather than leaving the viewer with a nameless account.
   *
   * Keyed on the two fields it reads, never on `user`: every `loadMe` builds a
   * fresh object, so depending on the object re-ran this effect on its own
   * result — `attempts` back to 0, three more timers — and an account whose
   * `profileReady` never flipped polled `/me` forever, dragging every consumer
   * of `user` along with it. The reassigned `timer` also means the cleanup
   * cancels whichever tick is actually pending, not just the first.
   */
  const userId = user?.userId;
  const profileReady = user?.profileReady ?? true;
  useEffect(() => {
    if (!userId || profileReady) return;

    let attempts = 0;
    let timer = 0;

    const tick = () => {
      attempts += 1;
      loadMe().catch(() => undefined);
      // ~11s total: auth-service's outbox only flushes every 5s, so the
      // registration event can take that long just to reach Kafka.
      if (attempts < 8) timer = window.setTimeout(tick, 1_500);
    };

    timer = window.setTimeout(tick, 800);
    return () => window.clearTimeout(timer);
  }, [userId, profileReady, loadMe]);

  /**
   * Everything after the tokens are already stored.
   *
   * `/me` failing here is not a failed login — the session exists, and the
   * credential that bought it has been spent. A single-use OTP is the sharp
   * case: rethrowing left the confirmation screen up, asking again for a code
   * the server had already consumed, so every retry answered `INVALID_OTP` and
   * the flow could not be finished at all. The throw stops here instead; the
   * profile fills in on the next `/me`.
   *
   * `close` is false only for a social account with no address, which the
   * modal goes on to ask for.
   */
  const settleSignIn = useCallback(async (close = true) => {
    // Every author resolved while signed out is a placeholder — user-service
    // will not answer without a token — and those must not outlive the moment
    // a token exists.
    resetViewerState();
    try {
      await loadMe();
    } catch {
      // ponytail: swallowed, because the next navigation or reload re-reads
      // `/me`. Retry here if a stale-looking header proves worth the machinery.
    }
    if (close) setLoginOpen(false);
  }, [loadMe]);

  const signIn = useCallback(
    async (
      usernameOrEmail: string,
      password: string,
      options?: { quiet?: boolean; reactivate?: boolean },
    ) => {
      await authApi.login({ usernameOrEmail, password, reactivate: options?.reactivate });
      await settleSignIn();
      if (!options?.quiet) toast.success(options?.reactivate ? "Welcome back!" : "You’re logged in.");
    },
    [settleSignIn],
  );

  const signUp = useCallback(
    async (input: { signupToken: string; username: string; password: string }) => {
      await authApi.completeSignup(input);
      // The profile is built off a Kafka event; leaving now would let a quick
      // tap on "Profile" hit an account that is not there yet.
      await awaitProfile();
      await settleSignIn();
      toast.success("Welcome to Nowa!");
    },
    [settleSignIn],
  );

  const signInWithProvider = useCallback(
    async (provider: SocialProvider, providerToken: string, options?: { reactivate?: boolean }) => {
      const result = await authApi.socialLogin(provider, providerToken, options);
      // A first sign-in with Google or Facebook creates the account too; for a
      // returning one the profile is already there and this answers at once.
      await awaitProfile();
      await settleSignIn(!result.requiresEmail);
      if (!result.requiresEmail) {
        toast.success(options?.reactivate ? "Welcome back!" : "You’re logged in.");
      }
      return { requiresEmail: result.requiresEmail };
    },
    [settleSignIn],
  );

  const confirmSocialLink = useCallback(
    async (provider: SocialProvider, input: { token: string; otp: string }) => {
      const result = await authApi.confirmSocialLink(provider, input);
      await settleSignIn(!result.requiresEmail);
      return { requiresEmail: result.requiresEmail };
    },
    [settleSignIn],
  );

  /**
   * `authApi.logout` drops the local tokens whatever happens, but still
   * rethrows a network failure — so signing out with the gateway unreachable
   * skipped everything below and left a signed-in-looking UI over a session
   * that no longer had tokens. The local sign-out is what was asked for, so it
   * happens either way — and the failure stops here rather than surfacing as
   * an unhandled rejection from a caller that fires and forgets: this device
   * is signed out, and the server-side tokens run out on their own.
   */
  const signOut = useCallback(async (options?: { quiet?: boolean }) => {
    try {
      await authApi.logout();
    } catch {
      // Gateway unreachable: the tokens are already gone locally.
    } finally {
      resetViewerState();
      setUser(null);
      router.push("/");
      if (!options?.quiet) toast.success("You’re logged out.");
    }
  }, [router]);

  const updateUser = useCallback((patch: Partial<SessionUser>) => {
    setUser((current) => (current ? { ...current, ...patch } : current));
  }, []);

  const updateProfile = useCallback(
    async (patch: { displayName?: string; bio?: string; avatarUrl?: string }) => {
      const profile = await usersApi.updateMyProfile(patch);
      setUser((current) =>
        current
          ? {
              ...current,
              nickname: profile.displayName ?? current.username,
              avatarUrl: profile.avatarUrl ?? current.avatarUrl,
              bio: profile.bio ?? "",
              followerCount: profile.followerCount,
              followingCount: profile.followingCount,
              nicknameChangeableAt: profile.displayNameChangeableAt ?? null,
            }
          : current,
      );
    },
    [],
  );

  const value = useMemo<SessionValue>(
    () => ({
      user,
      isSignedIn: user !== null,
      isLoading,
      requireSignIn: () => {
        if (user) return true;
        setLoginOpen(true);
        return false;
      },
      openLogin,
      signIn,
      signUp,
      signInWithProvider,
      confirmSocialLink,
      signOut,
      confirmSignOut: () => setLogoutConfirmOpen(true),
      reload: async () => {
        try {
          await loadMe();
        } catch (error) {
          // A dead session already cleared itself through `onSessionEnded`;
          // anything else is transient and keeps the current user on screen.
          if (isApiError(error) && error.status === 401) setUser(null);
        }
      },
      updateProfile,
      updateUser,
    }),
    [
      user,
      isLoading,
      openLogin,
      signIn,
      signUp,
      signInWithProvider,
      confirmSocialLink,
      signOut,
      loadMe,
      updateProfile,
      updateUser,
    ],
  );

  return (
    <SessionContext.Provider value={value}>
      {children}

      {loginModal.mounted && (
        <AuthModal
          closing={loginModal.closing}
          loginOptions={loginOptions}
          signupOptions={signupOptions}
          onClose={() => setLoginOpen(false)}
        />
      )}

      {logoutConfirm.mounted && (
        <LogoutConfirmModal
          closing={logoutConfirm.closing}
          onCancel={() => setLogoutConfirmOpen(false)}
          onConfirm={() => {
            setLogoutConfirmOpen(false);
            void signOut();
          }}
        />
      )}
    </SessionContext.Provider>
  );
}

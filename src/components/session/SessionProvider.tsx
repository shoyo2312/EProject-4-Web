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

import { LoginModal } from "@/components/session/LoginModal";
import { authorFromMe } from "@/lib/api/adapters";
import * as authApi from "@/lib/api/auth";
import { isApiError } from "@/lib/api/errors";
import { getAccessToken, getRefreshToken, onSessionEnded } from "@/lib/api/tokens";
import { getProviderToken, type SocialProvider } from "@/lib/auth/social";
import * as usersApi from "@/lib/api/users";
import type { MeResponse } from "@/lib/api/types";
import type { Author, LoginOption } from "@/types/tiktok";

/** The viewer: an `Author` for rendering, plus what only the account knows. */
export interface SessionUser extends Author {
  userId: string;
  email: string;
  bio: string;
  followerCount: number;
  followingCount: number;
  /**
   * False while user-service has not consumed the registration event yet, so
   * the social half of the profile is still missing. Kafka makes this
   * eventual; it usually resolves in a few hundred milliseconds.
   */
  profileReady: boolean;
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

  /** Real login. Throws `ApiError` so the form can branch on `code`. */
  signIn: (usernameOrEmail: string, password: string) => Promise<void>;
  /**
   * Google/Facebook login: runs the provider's SDK, then trades the token it
   * yields for our session. Signs up on first use — the backend has one
   * endpoint for both. Throws `SocialAuthError` when the provider side failed
   * or was cancelled, `ApiError` when ours rejected the token.
   */
  signInWithProvider: (provider: SocialProvider) => Promise<void>;
  signOut: () => Promise<void>;
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
  };
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
  children,
}: {
  loginOptions: LoginOption[];
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [user, setUser] = useState<SessionUser | null>(null);
  const [isLoading, setLoading] = useState(true);
  const [loginOpen, setLoginOpen] = useState(false);

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
        setUser(null);
        setLoading(false);
      }),
    [],
  );

  /**
   * A profile that was not ready at login (Kafka still catching up) is retried
   * a couple of times rather than leaving the viewer with a nameless account.
   */
  useEffect(() => {
    if (!user || user.profileReady) return;

    let cancelled = false;
    let attempts = 0;

    const tick = () => {
      attempts += 1;
      loadMe().catch(() => undefined);
      if (!cancelled && attempts < 3) window.setTimeout(tick, 1_500);
    };

    const timer = window.setTimeout(tick, 800);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [user, loadMe]);

  const signIn = useCallback(
    async (usernameOrEmail: string, password: string) => {
      await authApi.login({ usernameOrEmail, password });
      await loadMe();
      setLoginOpen(false);
    },
    [loadMe],
  );

  const signInWithProvider = useCallback(
    async (provider: SocialProvider) => {
      // The provider dialog must open inside the click that started this, so
      // nothing may be awaited before `getProviderToken`.
      const token = await getProviderToken(provider);
      await authApi.socialLogin(provider, token);
      await loadMe();
      setLoginOpen(false);
    },
    [loadMe],
  );

  const signOut = useCallback(async () => {
    await authApi.logout();
    setUser(null);
    router.push("/");
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
      signInWithProvider,
      signOut,
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
      signInWithProvider,
      signOut,
      loadMe,
      updateProfile,
      updateUser,
    ],
  );

  return (
    <SessionContext.Provider value={value}>
      {children}

      {loginOpen && (
        <LoginModal
          options={loginOptions}
          onClose={() => setLoginOpen(false)}
          // There is no in-modal password form on the live site either: every
          // row leads to the full login flow.
          onSignIn={() => {
            setLoginOpen(false);
            router.push("/login/phone-or-email/email");
          }}
        />
      )}
    </SessionContext.Provider>
  );
}

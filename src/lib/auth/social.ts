"use client";

/**
 * The provider half of social login: get a token *from* Google or Facebook.
 *
 * auth-service does not run an OAuth redirect dance — `POST
 * /api/v1/auth/oauth/{google,facebook}` takes a token the provider's own SDK
 * already issued to this client and trades it for our JWT pair. So the browser
 * only has to load the provider script, ask it for a token, and post it.
 *
 * Both SDKs are loaded from their own CDN on demand, and both are the vendor's
 * only supported distribution — there is no npm package to install here.
 *
 * Which token each side yields is fixed by the backend contract:
 *   Google   an **ID token** (`credential` from Google Identity Services)
 *   Facebook an **access token** (`authResponse.accessToken` from FB.login)
 */

export type SocialProvider = "google" | "facebook";

/**
 * Public because the browser needs them; they are client *identifiers*, not
 * secrets. The matching secrets (`GOOGLE_CLIENT_IDS`, `FB_APP_SECRET`) stay in
 * auth-service, which is what actually verifies the token.
 */
const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? "";
const FACEBOOK_APP_ID = process.env.NEXT_PUBLIC_FACEBOOK_APP_ID ?? "";

/** Facebook Graph version. Bump when the current one nears its sunset date. */
const FACEBOOK_SDK_VERSION = "v21.0";

/**
 * `cancelled` is the viewer closing the provider's dialog — not an error to
 * report. `unconfigured` is a missing client id, which is a deployment
 * problem, not something the viewer did wrong.
 */
export type SocialErrorKind = "cancelled" | "unconfigured" | "unavailable";

export class SocialAuthError extends Error {
  constructor(
    readonly kind: SocialErrorKind,
    message: string,
  ) {
    super(message);
    this.name = "SocialAuthError";
  }
}

export function isSocialCancellation(error: unknown): boolean {
  return error instanceof SocialAuthError && error.kind === "cancelled";
}

export function isSocialAuthError(error: unknown): error is SocialAuthError {
  return error instanceof SocialAuthError;
}

export function isProviderConfigured(provider: SocialProvider): boolean {
  return provider === "google"
    ? GOOGLE_CLIENT_ID !== ""
    : FACEBOOK_APP_ID !== "";
}

/**
 * Warms both SDKs so the click handler does not have to wait on a network
 * round trip before opening a popup — a popup opened too long after the click
 * is blocked by the browser.
 */
export function preloadSocialSdks(): void {
  if (isProviderConfigured("google")) {
    void loadScript(GOOGLE_SDK_SRC).catch(() => undefined);
  }
  if (isProviderConfigured("facebook")) {
    void loadScript(FACEBOOK_SDK_SRC).catch(() => undefined);
  }
}

/** Resolves with the provider token to post to auth-service. */
export function getProviderToken(provider: SocialProvider): Promise<string> {
  if (!isProviderConfigured(provider)) {
    return Promise.reject(
      new SocialAuthError(
        "unconfigured",
        provider === "google"
          ? "Google sign-in isn’t configured on this deployment."
          : "Facebook sign-in isn’t configured on this deployment.",
      ),
    );
  }
  return provider === "google" ? googleIdToken() : facebookAccessToken();
}

/* --- Google Identity Services -------------------------------------------- */

const GOOGLE_SDK_SRC = "https://accounts.google.com/gsi/client";

interface GoogleCredentialResponse {
  credential?: string;
}

interface GooglePromptNotification {
  isNotDisplayed?: () => boolean;
  isSkippedMoment?: () => boolean;
}

interface GoogleAccountsId {
  initialize: (config: {
    client_id: string;
    callback: (response: GoogleCredentialResponse) => void;
    auto_select?: boolean;
    cancel_on_tap_outside?: boolean;
  }) => void;
  prompt: (listener?: (notification: GooglePromptNotification) => void) => void;
  cancel: () => void;
}

/**
 * Nothing settles a prompt Google decides not to show. Under FedCM the two
 * notification predicates below are deprecated and answer nothing, so a
 * suppressed prompt fires no callback, no notification and no error — which
 * left the caller's `pending` flag on "Connecting…" and every login row
 * disabled until a reload. This is the backstop that ends that wait.
 */
const GOOGLE_PROMPT_TIMEOUT_MS = 60_000;

/**
 * The account chooser, via `google.accounts.id.prompt()`.
 *
 * ponytail: this is the One Tap / FedCM prompt rather than a rendered Google
 * button, so the TikTok-styled row stays the thing the viewer clicks. The cost
 * is that a viewer who has dismissed the prompt repeatedly gets suppressed by
 * Google, and now lands in the `unavailable` branch via the timeout instead of
 * hanging. If that shows up in practice, swap to
 * `google.accounts.id.renderButton` over the row — the only flow Google does
 * not suppress that still yields the ID token auth-service verifies.
 */
async function googleIdToken(): Promise<string> {
  await loadScript(GOOGLE_SDK_SRC);
  const accounts = window.google?.accounts?.id;
  if (!accounts) {
    throw new SocialAuthError("unavailable", "Google sign-in failed to load.");
  }

  return new Promise<string>((resolve, reject) => {
    const timer = window.setTimeout(() => {
      accounts.cancel();
      fail(
        new SocialAuthError(
          "unavailable",
          "Google didn’t open its sign-in dialog. Check that third-party sign-in is allowed in this browser, or log in with your email instead.",
        ),
      );
    }, GOOGLE_PROMPT_TIMEOUT_MS);

    const done = (credential: string) => {
      window.clearTimeout(timer);
      resolve(credential);
    };
    const fail = (error: SocialAuthError) => {
      window.clearTimeout(timer);
      reject(error);
    };

    accounts.initialize({
      client_id: GOOGLE_CLIENT_ID,
      auto_select: false,
      cancel_on_tap_outside: true,
      callback: (response) => {
        if (response.credential) done(response.credential);
        else fail(new SocialAuthError("cancelled", "Google sign-in cancelled."));
      },
    });

    accounts.prompt((notification) => {
      // Both predicates are optional under FedCM, hence the guards. When one
      // does answer true, the callback above will never fire, so settle here.
      if (notification.isNotDisplayed?.()) {
        fail(
          new SocialAuthError(
            "unavailable",
            "Google didn’t open its sign-in dialog. Check that third-party sign-in is allowed in this browser.",
          ),
        );
      } else if (notification.isSkippedMoment?.()) {
        fail(new SocialAuthError("cancelled", "Google sign-in cancelled."));
      }
    });
  });
}

/* --- Facebook JS SDK ------------------------------------------------------ */

const FACEBOOK_SDK_SRC = "https://connect.facebook.net/en_US/sdk.js";

interface FacebookLoginResponse {
  status: string;
  authResponse?: { accessToken?: string };
}

interface FacebookSdk {
  init: (config: {
    appId: string;
    version: string;
    cookie?: boolean;
    xfbml?: boolean;
  }) => void;
  login: (
    callback: (response: FacebookLoginResponse) => void,
    options?: { scope?: string },
  ) => void;
}

/** `FB.init` is idempotent but pointless to repeat; once per page is enough. */
let facebookReady = false;

async function facebookAccessToken(): Promise<string> {
  await loadScript(FACEBOOK_SDK_SRC);
  const fb = window.FB;
  if (!fb) {
    throw new SocialAuthError("unavailable", "Facebook sign-in failed to load.");
  }

  if (!facebookReady) {
    fb.init({
      appId: FACEBOOK_APP_ID,
      version: FACEBOOK_SDK_VERSION,
      // No FB cookie and no XFBML parsing: the session that matters is ours,
      // and the only thing this SDK is here for is the access token.
      cookie: false,
      xfbml: false,
    });
    facebookReady = true;
  }

  return new Promise<string>((resolve, reject) => {
    fb.login(
      (response) => {
        const token = response.authResponse?.accessToken;
        if (token) resolve(token);
        else {
          reject(
            new SocialAuthError("cancelled", "Facebook sign-in cancelled."),
          );
        }
      },
      // `email` is a review-gated permission and may be declined; the backend
      // answers `requiresEmail` when it ends up missing, so asking is enough.
      { scope: "public_profile,email" },
    );
  });
}

/* --- script loading ------------------------------------------------------- */

const loading = new Map<string, Promise<void>>();

/** Loads a third-party script once; later callers get the same promise. */
function loadScript(src: string): Promise<void> {
  const pending = loading.get(src);
  if (pending) return pending;

  const promise = new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => {
      // Dropped from the cache so a later attempt can retry — a blocked script
      // is usually an extension or a flaky network, both of which can change.
      loading.delete(src);
      reject(
        new SocialAuthError("unavailable", "Couldn’t reach the sign-in provider."),
      );
    };
    document.head.appendChild(script);
  });

  loading.set(src, promise);
  return promise;
}

declare global {
  interface Window {
    google?: { accounts?: { id?: GoogleAccountsId } };
    FB?: FacebookSdk;
  }
}

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
 *   Google   an **access token** (Google Identity Services' token client)
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
  return provider === "google" ? googleAccessToken() : facebookAccessToken();
}

/* --- Google Identity Services -------------------------------------------- */

const GOOGLE_SDK_SRC = "https://accounts.google.com/gsi/client";

interface GoogleTokenResponse {
  access_token?: string;
  error?: string;
}

interface GoogleTokenClient {
  requestAccessToken: () => void;
}

interface GoogleOAuth2 {
  initTokenClient: (config: {
    client_id: string;
    scope: string;
    prompt?: "" | "none" | "consent" | "select_account";
    callback: (response: GoogleTokenResponse) => void;
    error_callback?: (error: { type?: string }) => void;
  }) => GoogleTokenClient;
}

/**
 * Google's account chooser in a popup, via the OAuth token client.
 *
 * This is the one Google flow that opens from a button we draw: the ID-token
 * flows either need Google's own rendered button (which ignores clicks unless
 * it is visibly on top) or the One Tap prompt (which Google suppresses after a
 * few dismissals and then never calls back). The token client is a plain
 * popup, settled by `callback` or `error_callback` like Facebook's.
 * auth-service checks the access token's `aud` against our client id.
 */
async function googleAccessToken(): Promise<string> {
  await loadScript(GOOGLE_SDK_SRC);
  const oauth2 = window.google?.accounts?.oauth2;
  if (!oauth2) {
    throw new SocialAuthError("unavailable", "Google sign-in failed to load.");
  }

  return new Promise<string>((resolve, reject) => {
    oauth2
      .initTokenClient({
        client_id: GOOGLE_CLIENT_ID,
        scope: "openid email profile",
        // Lets a viewer who signed out pick a different account next time.
        prompt: "select_account",
        callback: (response) => {
          if (response.access_token) resolve(response.access_token);
          else {
            reject(new SocialAuthError("cancelled", "Google sign-in cancelled."));
          }
        },
        error_callback: (error) => {
          reject(
            error.type === "popup_failed_to_open"
              ? new SocialAuthError(
                  "unavailable",
                  "Google’s sign-in window was blocked. Allow pop-ups for this site and try again.",
                )
              : new SocialAuthError("cancelled", "Google sign-in cancelled."),
          );
        },
      })
      .requestAccessToken();
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
  // Facebook refuses `FB.login` from http pages and never calls back, which
  // would leave the row spinning. Say why instead — `next dev --experimental-https`
  // serves localhost over https.
  if (window.location.protocol !== "https:") {
    throw new SocialAuthError(
      "unavailable",
      "Facebook sign-in only works over HTTPS.",
    );
  }
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
    google?: { accounts?: { oauth2?: GoogleOAuth2 } };
    FB?: FacebookSdk;
  }
}

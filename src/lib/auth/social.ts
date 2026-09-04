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
  // Google no longer comes through here — its account chooser is opened by the
  // Google-rendered button (`renderGoogleButton`), not a click we control.
  if (provider === "google") {
    return Promise.reject(
      new SocialAuthError(
        "unavailable",
        "Use the Google button to choose an account.",
      ),
    );
  }
  if (!isProviderConfigured("facebook")) {
    return Promise.reject(
      new SocialAuthError(
        "unconfigured",
        "Facebook sign-in isn’t configured on this deployment.",
      ),
    );
  }
  return facebookAccessToken();
}

/* --- Google Identity Services -------------------------------------------- */

const GOOGLE_SDK_SRC = "https://accounts.google.com/gsi/client";

interface GoogleCredentialResponse {
  credential?: string;
}

interface GoogleAccountsId {
  initialize: (config: {
    client_id: string;
    callback: (response: GoogleCredentialResponse) => void;
    auto_select?: boolean;
    cancel_on_tap_outside?: boolean;
  }) => void;
  renderButton: (
    parent: HTMLElement,
    options: {
      type?: "standard" | "icon";
      theme?: "outline" | "filled_blue" | "filled_black";
      text?: "signin_with" | "signup_with" | "continue_with" | "signin";
      shape?: "rectangular" | "pill" | "circle" | "square";
      size?: "large" | "medium" | "small";
      width?: number;
    },
  ) => void;
  cancel: () => void;
}

/**
 * Renders Google's own "Continue with Google" button into `el`, and calls
 * `onCredential` with the ID token once the viewer picks an account.
 *
 * ponytail: this is `renderButton`, not One Tap (`prompt()`). The button is the
 * only Google flow that opens the real account-chooser popup, is not
 * suppressed after repeated dismissals, and still yields the `credential` ID
 * token auth-service verifies. The caller overlays it transparently on the
 * styled row, so the row stays the thing the viewer sees.
 *
 * Returns a cleanup that cancels any open prompt and empties `el`.
 */
export function renderGoogleButton(
  el: HTMLElement,
  onCredential: (idToken: string) => void,
): () => void {
  let cancelled = false;

  if (!isProviderConfigured("google")) {
    return () => undefined;
  }

  void loadScript(GOOGLE_SDK_SRC)
    .then(() => {
      if (cancelled) return;
      const id = window.google?.accounts?.id;
      if (!id) return;
      id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        auto_select: false,
        cancel_on_tap_outside: true,
        callback: (response) => {
          if (response.credential) onCredential(response.credential);
        },
      });
      id.renderButton(el, {
        type: "standard",
        theme: "filled_black",
        text: "continue_with",
        shape: "pill",
        size: "large",
        // Google clamps width to 200–400; the row sits inside that range.
        width: Math.min(400, Math.max(200, Math.round(el.offsetWidth) || 320)),
      });
    })
    .catch(() => undefined);

  return () => {
    cancelled = true;
    try {
      window.google?.accounts?.id?.cancel();
    } catch {
      // SDK never finished loading — nothing to cancel.
    }
    el.replaceChildren();
  };
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

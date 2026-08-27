"use client";

/**
 * Cloudflare Turnstile, loaded from its own CDN like the Google/Facebook SDKs
 * in `social.ts` — no npm package to install, vendor's only supported
 * distribution. Only ever mounted when the backend has already rejected a
 * request with `TURNSTILE_VERIFICATION_FAILED` (see auth-service
 * `OtpRateLimiter.requiresTurnstile`), so most viewers never load this script.
 */

const SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? "";
const SDK_SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js";

export function isTurnstileConfigured(): boolean {
  return SITE_KEY !== "";
}

interface TurnstileRenderOptions {
  sitekey: string;
  callback: (token: string) => void;
  "error-callback"?: () => void;
  "expired-callback"?: () => void;
}

interface TurnstileApi {
  render: (container: HTMLElement, options: TurnstileRenderOptions) => string;
  remove: (widgetId: string) => void;
}

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

const loading = new Map<string, Promise<void>>();

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
      loading.delete(src);
      reject(new Error("Couldn’t reach challenges.cloudflare.com."));
    };
    document.head.appendChild(script);
  });

  loading.set(src, promise);
  return promise;
}

/**
 * Mounts a widget into `container`; returns the id to pass to
 * {@link removeTurnstile}, or `undefined` if `isCancelled` went true while the
 * script was loading.
 *
 * `isCancelled` is checked right before the actual `render()` call, not after
 * — React 18 Strict Mode fires effect → cleanup → effect once per mount in
 * dev, and both effect runs start this function before either's `await
 * loadScript` resolves. Checking only in the `.then` (after render already
 * ran) let both calls hit `render()` on the same container; Cloudflare
 * rejects the second one outright, so the widget never appeared at all.
 */
export async function renderTurnstile(
  container: HTMLElement,
  handlers: { onToken: (token: string) => void; onError?: () => void },
  isCancelled: () => boolean,
): Promise<string | undefined> {
  await loadScript(SDK_SRC);
  if (isCancelled()) return undefined;
  if (!window.turnstile) {
    throw new Error("Turnstile failed to load.");
  }
  return window.turnstile.render(container, {
    sitekey: SITE_KEY,
    callback: handlers.onToken,
    "error-callback": handlers.onError,
    "expired-callback": handlers.onError,
  });
}

export function removeTurnstile(widgetId: string): void {
  window.turnstile?.remove(widgetId);
}

"use client";

import { GoogleSignInOverlay } from "@/components/auth/GoogleSignInOverlay";
import {
  FacebookBrandIcon,
  GoogleBrandIcon,
  PersonIcon,
  QrCodeIcon,
} from "@/components/icons";
import type { SocialProvider } from "@/lib/auth/social";
import type { LoginOption } from "@/types/tiktok";

/**
 * The first screen of either flow — "Log in to Nowa" or "Sign up for Nowa"
 * over the option list. Measured live:
 *
 *   column  380 wide, 24px in from the card edge (8 of it the scroller's)
 *   title   33/49.5/700, margin 56px 0 16px, centred
 *   list    296 tall and scrolling, padding 8px 32px 0 40px
 *   row     300 × 48 pill, `rgba(255,255,255,.13)`, 16px/600 centred,
 *           20px glyph 12px from the left edge, 8px between rows
 */
export function OptionsStep({
  title,
  options,
  onSelect,
  mountGoogle,
  pending,
}: {
  title: string;
  options: LoginOption[];
  onSelect: (option: LoginOption) => void;
  mountGoogle: ((el: HTMLElement) => () => void) | undefined;
  /** The provider whose dialog is open, if any — the list freezes meanwhile. */
  pending: SocialProvider | null;
}) {
  return (
    <div className="mx-4">
      <h2 className="mt-14 mb-4 text-center text-[33px] leading-[49.5px] font-bold text-[var(--tt-text)]">
        {title}
      </h2>

      {/* The list scrolls inside the card — live, the sixth row is clipped,
          which is how the scroll is signalled. */}
      <div className="no-scrollbar h-[296px] flex flex-col justify-center overflow-y-auto pt-2 pr-8 pl-10">
        {options.map((option) => (
          <div key={option.label} className="relative mb-2 w-[300px] max-w-full">
            <button
              type="button"
              onClick={() => onSelect(option)}
              disabled={pending !== null}
              className="relative flex h-12 w-full items-center justify-center rounded-[24px] bg-[var(--tt-field)] pr-3.5 pl-2.5 text-[16px] leading-5 font-semibold text-[var(--tt-text)] transition-colors hover:bg-[var(--tt-shape-neutral-3)] disabled:opacity-50"
            >
              <span className="absolute left-3 flex">
                <OptionIcon option={option} />
              </span>
              <span className="truncate px-6">
                {pending && pending === option.provider ? "Connecting…" : option.label}
              </span>
            </button>
            {option.provider === "google" && mountGoogle && (
              <GoogleSignInOverlay mount={mountGoogle} />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * `.DivAgreement` — the legal note between the list and the footer. It sits
 * outside the scrolling part, so it never scrolls away. The signup wording
 * names the account's region, as the live one does.
 */
export function Agreement({ flow }: { flow: "login" | "signup" }) {
  return (
    <div className="flex flex-none justify-center px-[30px] py-4">
      <p className="w-[300px] max-w-full text-center text-[10px] leading-[13px] text-[var(--tt-text-muted)]">
        {flow === "signup" ? (
          <>
            By continuing with an account located in{" "}
            <span className="text-[11px] font-semibold text-[var(--tt-text)]">
              Vietnam
            </span>
            , you agree to our{" "}
            <span className="text-[var(--tt-text)]">Terms of Service</span> and
            acknowledge that you have read our{" "}
            <span className="text-[var(--tt-text)]">Privacy Policy</span>.
          </>
        ) : (
          <>
            By continuing, you agree to Nowa&rsquo;s{" "}
            <span className="text-[var(--tt-text)]">Terms of Service</span> and
            confirm that you have read Nowa&rsquo;s{" "}
            <span className="text-[var(--tt-text)]">Privacy Policy</span>.
          </>
        )}
      </p>
    </div>
  );
}

/**
 * The QR and email rows use TikTok's own glyphs; Facebook and Google — the two
 * this deployment can sign in with — show the provider's real logo. Any other
 * third-party row falls back to a 20px disc in its brand colour.
 */
function OptionIcon({ option }: { option: LoginOption }) {
  if (option.icon === "qr") {
    return <QrCodeIcon className="h-5 w-5 flex-none text-[var(--tt-text)]" />;
  }
  if (option.icon === "person") {
    return <PersonIcon className="h-5 w-5 flex-none text-[var(--tt-text)]" />;
  }
  if (option.provider === "facebook") {
    return <FacebookBrandIcon className="h-5 w-5 flex-none" />;
  }
  if (option.provider === "google") {
    return <GoogleBrandIcon className="h-5 w-5 flex-none" />;
  }
  return (
    <span
      aria-hidden="true"
      className="h-5 w-5 flex-none rounded-full"
      style={{ backgroundColor: option.tint }}
    />
  );
}

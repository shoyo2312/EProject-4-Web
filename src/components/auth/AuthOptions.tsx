"use client";

import {
  FacebookBrandIcon,
  GoogleBrandIcon,
  PersonIcon,
  QrCodeIcon,
} from "@/components/icons";
import type { SocialProvider } from "@/lib/auth/social";
import type { LoginOption } from "@/types/tiktok";

/**
 * The option list both landing pages show, and the legal paragraph under it.
 *
 * Measured live (see `docs/research/tiktok.com/AUTH.md`):
 *   column      363 wide, 64px under the header, centred text
 *   title       33/49.5/700, 16px above the description
 *   description 15/18/400 `rgba(255,255,255,.34)`, 20px above the first row
 *   row         345 × 46, radius **8**, `rgba(255,255,255,.08)`, 16/24/600,
 *               `padding: 0 14px 0 10px`, 20px glyph, rows 12px apart
 *   last login  11/16/600 on #20D5EC, radius `10px 10px 10px 2px`,
 *               `padding: 0 8px`, overlapping the row's top-right corner
 *
 * The rows are pills of a different shape to the login modal's — the modal
 * uses 300 × 48 at radius 24 on `rgba(255,255,255,.13)`. Same list, two
 * designs; both are reproduced as measured.
 */
export function AuthOptions({
  title,
  description,
  options,
  onSelect,
  pending = null,
  error = null,
}: {
  title: string;
  description: string;
  options: LoginOption[];
  /** Called with the row's label; the caller decides where it leads. */
  onSelect: (option: LoginOption) => void;
  /** The provider whose dialog is open, if any — the list freezes meanwhile. */
  pending?: SocialProvider | null;
  /** A failed social login, shown under the list rather than in a dialog. */
  error?: string | null;
}) {
  return (
    <>
      <h1 className="mb-4 text-[33px] leading-[49.5px] font-bold text-[var(--tt-text)]">
        {title}
      </h1>

      {/* The live padding here is asymmetric (13 left, 5 right) to leave room
          for a scrollbar that never appears, which leaves the rows 4px off
          centre. Evened out. */}
      <div className="px-[9px] pt-2 pb-0.5">
        <p className="mb-5 text-[15px] leading-[18px] text-[rgb(255_255_255/0.34)]">
          {description}
        </p>

        {options.map((option) => (
          <div key={option.label} className="relative mb-3">
            {option.lastLogin && (
              <span className="absolute -top-2 right-3 z-10 rounded-[10px_10px_10px_2px] bg-[#20d5ec] px-2 text-[11px] leading-4 font-semibold text-[#161823]">
                Last login
              </span>
            )}
            <button
              type="button"
              onClick={() => onSelect(option)}
              disabled={pending !== null}
              className="flex h-[46px] w-full items-center rounded-[8px] bg-white/[0.08] pr-3.5 pl-2.5 text-[16px] leading-6 font-semibold text-[var(--tt-text)] transition-colors hover:bg-white/[0.12] disabled:opacity-50"
            >
              <OptionIcon option={option} />
              <span className="flex-1 text-center">
                {pending && pending === option.provider
                  ? "Connecting…"
                  : option.label}
              </span>
            </button>
          </div>
        ))}

        {error && (
          <p
            role="alert"
            className="mt-3 text-[13px] leading-[18px] text-[var(--tt-red-active)]"
          >
            {error}
          </p>
        )}
      </div>
    </>
  );
}

/**
 * `.DivAgreement` — the legal note under the option list. Present on both
 * landing pages and on neither of the form steps.
 *
 * 337 wide, 12/15/400 `rgba(255,255,255,.5)`, with the three links at the same
 * size in `rgba(255,255,255,.9)`; `padding: 16px 30px`, 80px of air beneath.
 */
export function AuthAgreement({ verb }: { verb: string }) {
  return (
    <div className="mb-20 flex justify-center px-8 py-4">
      <p className="w-[337px] text-center text-[12px] leading-[15px] text-[var(--tt-text-muted)]">
        By {verb} with an account located in{" "}
        <span className="text-[var(--tt-text)]">Vietnam</span>, you agree to our{" "}
        <span className="text-[var(--tt-text)]">Terms of Service</span> and
        acknowledge that you have read our{" "}
        <span className="text-[var(--tt-text)]">Privacy Policy</span>.
      </p>
    </div>
  );
}

/**
 * The QR and phone/email rows use TikTok's own glyphs. The Facebook and Google
 * rows — the two this deployment can actually sign in with — show the
 * provider's real logo. Any remaining third-party row (LINE, KakaoTalk, Apple)
 * with no `provider` falls back to a plain 20px disc in its brand colour.
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

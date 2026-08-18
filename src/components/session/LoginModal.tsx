"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect } from "react";

import { SocialLinkForm } from "@/components/auth/SocialLinkForm";
import { useSocialSignIn } from "@/components/auth/use-social-sign-in";
import { CloseIcon, PersonIcon, QrCodeIcon } from "@/components/icons";
import type { LoginOption } from "@/types/tiktok";

/**
 * `.DivModalContainer` → `.DivContentContainer` — the login modal, which the
 * live site puts in front of every action a signed-out viewer cannot take
 * (liking, following, bookmarking). Measured live at 1440px, signed out:
 *
 *   mask       `.DivModalMask`, fixed, rgba(0, 0, 0, .68)
 *   container  fixed, z-index 3001, centres its child
 *   card       428 × 562, background #1E1E1E, radius 24,
 *              padding-bottom 64 (reserved for the sticky footer)
 *   close      32 × 32 disc, rgba(255, 255, 255, .04), absolute top/right 24
 *   title      "Log in to TikTok", 33px/700, line-height 49.5,
 *              margin 56px 0 16px, centred
 *   options    380 wide, padding 8px 32px 0 40px, overflow-y auto, 296 tall
 *   option     300 × 48 pill, rgba(255, 255, 255, .13), radius 24,
 *              16px/600, padding 0 14px 0 10px, 20px icon, 8px between rows
 *   legal      300 wide, 10px/400/13px, rgba(255, 255, 255, .5), centred
 *   footer     absolute, 428 × 64, border-top .5px rgba(255, 255, 255, .12),
 *              15px/400, with "Sign up" in #FF3B5C
 */
export function LoginModal({
  options,
  onClose,
  onSignIn,
}: {
  options: LoginOption[];
  onClose: () => void;
  onSignIn: () => void;
}) {
  const router = useRouter();

  /**
   * Facebook and Google sign in without leaving the modal — the provider's own
   * dialog is the whole flow, and `signInWithProvider` closes this on success.
   * Every other row behaves as it did: the phone/email one goes to the login
   * page, the rest hand back to the caller.
   */
  const social = useSocialSignIn({
    onFallback: useCallback(
      (option: LoginOption) => {
        if (option.icon === "person") router.push("/login/phone-or-email");
        else onSignIn();
      },
      [router, onSignIn],
    ),
  });

  /**
   * Escape and the backdrop are the two ways a modal gets dismissed by
   * accident, and during a link challenge that costs the provider token — it
   * lives in `useSocialSignIn`'s state and nowhere else, so unmounting strands
   * the code that just arrived by email and the whole provider dance has to be
   * repeated. So they step back to the option list instead.
   *
   * The close button goes through here too. Costing somebody the code they
   * were just mailed is not what a stray click on an X should buy, and
   * stepping back first still leaves the modal one click from closed.
   */
  const { challenge, cancel } = social;
  const dismiss = useCallback(() => {
    if (challenge) cancel();
    else onClose();
  }, [challenge, cancel, onClose]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") dismiss();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [dismiss]);

  return (
    <div className="fixed inset-0 z-[3001] flex items-center justify-center">
      <button
        type="button"
        aria-label={challenge ? "Back to login options" : "Close"}
        onClick={dismiss}
        className="absolute inset-0 cursor-default bg-black/[0.68]"
      />

      <div
        role="dialog"
        aria-modal="true"
        /* Named directly rather than by `aria-labelledby`: the heading below is
           not rendered during a challenge, and a label pointing at an absent —
           or `hidden`, which is the same thing to the a11y tree — element
           leaves the dialog with no name at all. */
        aria-label={challenge ? "Confirm it's you" : "Log in to TikTok"}
        className="relative max-h-full w-[428px] max-w-full overflow-hidden rounded-[24px] bg-[#1e1e1e] pb-20"
      >
        <button
          type="button"
          onClick={dismiss}
          aria-label={challenge ? "Back to login options" : "Close"}
          className="absolute top-6 right-6 flex h-8 w-8 items-center justify-center rounded-full bg-white/[0.04] text-[var(--tt-text)] transition-colors hover:bg-white/10"
        >
          <CloseIcon className="h-5 w-5" />
        </button>

        {!challenge && (
          <h2 className="mx-auto mt-14 mb-4 w-[380px] max-w-full text-center text-[33px] leading-[49.5px] font-bold text-[var(--tt-text)]">
            Log in to TikTok
          </h2>
        )}

        {challenge ? (
          <div className="mx-auto mt-14 w-[380px] max-w-full px-8">
            <SocialLinkForm
              challenge={challenge}
              onConfirm={social.confirm}
              onCancel={cancel}
              error={social.error}
              busy={social.pending !== null}
              compact
            />
          </div>
        ) : (
          /* The list scrolls inside the card — the live modal shows five of
             the seven options and clips the sixth, which is how the scroll is
             signalled. */
          <div className="no-scrollbar mx-auto h-[296px] w-[380px] max-w-full overflow-y-auto pt-2 pr-8 pl-10">
            {options.map((option) => (
              <button
                key={option.label}
                type="button"
                onClick={() => social.select(option)}
                disabled={social.pending !== null}
                className="mb-2 flex h-12 w-[300px] max-w-full items-center justify-center rounded-[24px] bg-[var(--tt-field)] pr-3.5 pl-2.5 text-[16px] font-semibold text-[var(--tt-text)] transition-colors hover:bg-[var(--tt-shape-neutral-3)] disabled:opacity-50"
              >
                <OptionIcon option={option} />
                <span className="flex-1 text-center">
                  {social.pending && social.pending === option.provider
                    ? "Connecting…"
                    : option.label}
                </span>
              </button>
            ))}

            {social.error && (
              <p
                role="alert"
                className="w-[300px] max-w-full text-center text-[13px] leading-[18px] text-[var(--tt-red-active)]"
              >
                {social.error}
              </p>
            )}
          </div>
        )}

        {/* 39px below the option list; the 16px above the footer rule comes
            from the card's 80px bottom padding against the 64px footer, which
            together make the card 562 tall at the measured content. */}
        <p className="mx-auto mt-10 w-[300px] max-w-full text-center text-[10px] leading-[13px] text-[var(--tt-text-muted)]">
          By continuing, you agree to TikTok&rsquo;s{" "}
          <strong className="font-bold text-[var(--tt-text-muted)]">
            Terms of Service
          </strong>{" "}
          and confirm that you have read TikTok&rsquo;s{" "}
          <strong className="font-bold text-[var(--tt-text-muted)]">
            Privacy Policy
          </strong>
          .
        </p>

        <div className="absolute inset-x-0 bottom-0 flex h-16 items-center justify-center gap-1 border-t-[0.5px] border-[var(--tt-divider)] text-[15px] leading-[18px] text-[var(--tt-text)]">
          Don&rsquo;t have an account?
          {/* Live, this swaps the modal to its signup list. Ours links out to
              the signup page, for the same reason as the row above. */}
          <Link
            href="/signup"
            onClick={onClose}
            className="font-semibold text-[var(--tt-red-active)]"
          >
            Sign up
          </Link>
        </div>
      </div>
    </div>
  );
}

/**
 * The QR and phone/email rows use TikTok's own glyphs. The four third-party
 * rows are kept verbatim in label and layout, but deliberately render a plain
 * 20px disc in the provider's brand colour instead of the provider's logo —
 * those are other companies' trademarks and do not belong in this repo.
 */
function OptionIcon({ option }: { option: LoginOption }) {
  if (option.icon === "qr") {
    return <QrCodeIcon className="h-5 w-5 flex-none text-[var(--tt-text)]" />;
  }
  if (option.icon === "person") {
    return <PersonIcon className="h-5 w-5 flex-none text-[var(--tt-text)]" />;
  }
  return (
    <span
      aria-hidden="true"
      className="h-5 w-5 flex-none rounded-full"
      style={{ backgroundColor: option.tint }}
    />
  );
}

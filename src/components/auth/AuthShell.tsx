import Link from "next/link";

import { HelpCircleIcon } from "@/components/icons";
import { TikTokWordmark } from "@/components/layout/TikTokWordmark";

/**
 * The chrome `/login` and `/signup` share. Neither page has the sidebar or the
 * top bar — they are the only routes on the site with a header of their own.
 *
 * Measured live at 1920×936 (see `docs/research/tiktok.com/AUTH.md`):
 *   page    #121212 throughout, a fixed 60px header over a scrolling body
 *           over a footer that is always at the end of the document
 *   header  flex space-between, `padding: 0 20px 0 16px`, logo 118×42,
 *           help link 20px glyph + 7px gap + 14/17/600
 *   alt bar 64 tall, `border-top: 1px solid rgba(255,255,255,.12)`, 15/18/400
 *           with the link at 15/600 in #FF3B5C
 *   bottom  84 tall, `padding: 0 144px`, language select 172×36 with a 1px
 *           #8A8B91 border at radius 2, copyright 14/28/500 in #8A8B91
 *
 * The body is the scroller, not the window: on a short viewport the option
 * list slides under the footer rather than pushing it down.
 */
export function AuthShell({
  altPrompt,
  altLabel,
  altHref,
  agreement,
  children,
}: {
  /** e.g. "Don't have an account?" */
  altPrompt: string;
  /** e.g. "Sign up" */
  altLabel: string;
  altHref: string;
  /**
   * The legal note. It belongs to the footer, not to the scrolling body —
   * which is why the live option list is clipped by it on a short viewport
   * instead of pushing it down.
   */
  agreement?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-screen w-full flex-col bg-[#121212]">
      <header className="flex h-15 flex-none items-center justify-between pr-5 pl-4">
        <Link href="/" aria-label="TikTok" className="flex items-center">
          <TikTokWordmark className="h-[42px] w-[118px] text-white" />
        </Link>

        <a
          href="https://support.tiktok.com"
          target="_blank"
          rel="noreferrer noopener"
          className="flex items-center text-[14px] leading-[17px] font-semibold text-[var(--tt-text)]"
        >
          <HelpCircleIcon className="h-5 w-5 flex-none" />
          <span className="ml-[7px]">Feedback and help</span>
        </a>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>

      <footer className="flex-none">
        {agreement}

        <div className="flex h-16 items-center justify-center border-t border-[var(--tt-divider)] text-[15px] leading-[18px] text-[var(--tt-text)]">
          {altPrompt}
          <Link
            href={altHref}
            className="ml-[5px] font-semibold text-[var(--tt-red-active)]"
          >
            {altLabel}
          </Link>
        </div>

        <div className="flex h-21 items-center justify-between px-36 tt-840:px-6">
          <LanguageSelect />
          <span className="text-[14px] leading-7 font-medium text-[#8a8b91]">
            &copy; 2026 TikTok
          </span>
        </div>
      </footer>
    </div>
  );
}

/**
 * The live control is a styled `<p>` with a transparent `<select>` stretched
 * over it. Ours is the plain select — the clone has no second locale to switch
 * to, so the only thing the overlay would buy is the custom caret.
 */
function LanguageSelect() {
  return (
    <select
      aria-label="Language"
      defaultValue="en-US"
      className="h-9 w-[172px] rounded-[2px] border border-[#8a8b91] bg-transparent px-4 text-[14px] leading-9 text-white"
    >
      <option value="en-US">English (US)</option>
    </select>
  );
}

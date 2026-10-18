"use client";

import Link from "next/link";
import { useState } from "react";

import { ChevronRightIcon } from "@/components/icons";
import { DELETION_GRACE_DAYS } from "@/lib/account/closure";
import { cn } from "@/lib/utils";

/** Where a suggestion leads: a Settings section, or a page of the app. */
type Destination = { section: string } | { href: string };

interface Suggestion {
  label: string;
  to: Destination;
}

interface Reason {
  label: string;
  suggestions?: Suggestion[];
}

const MAX_DETAIL = 140;

/**
 * The live reasons, in order. Each suggestion points where this app has the
 * feature; those it has nothing for ("Report a problem", "Get more tips", and
 * every ads link) are left out rather than shown going nowhere.
 */
function reasonsFor(username: string): Reason[] {
  return [
    { label: "I’m leaving temporarily" },
    {
      label: "I’m on Nowa too much",
      suggestions: [{ label: "Setting a limit on your watch time", to: { section: "screen-time" } }],
    },
    {
      label: "Safety or privacy concerns",
      suggestions: [
        { label: "Keeping your account secure", to: { section: "manage-account" } },
        {
          label: "Switching to a private account and managing privacy settings",
          to: { section: "privacy" },
        },
        { label: "Blocking users", to: { section: "privacy" } },
      ],
    },
    { label: "Too many irrelevant ads" },
    {
      label: "Trouble getting started",
      suggestions: [
        { label: "Setting up your profile", to: { href: `/@${username}` } },
        { label: "Exploring videos", to: { href: "/explore" } },
        { label: "Creating your first video", to: { href: "/upload" } },
      ],
    },
    { label: "I have multiple accounts" },
    { label: "Another reason" },
  ];
}

const TEMPORARY = 0;
const ANOTHER = 6;

/**
 * "Before you go, can we help?" — the first step of a delete, as live. Nothing
 * here is sent anywhere: no service collects the reason, so it only steers the
 * reader to the feature that might keep them.
 *
 * Measured live at 1920px:
 *   body      `padding: 24px 32px 0`; title 24/36/700 #F6F6F6 + 20, intro
 *             15/22.5 `.88` + 24
 *   option    48 tall (`padding: 12px 0`), label 16/24 #F6F6F6, 22px radio
 *             ringed `inset 0 0 0 1.5px rgba(255,255,255,.32)`; checked it
 *             fills #FE2C55 around a 9px white dot
 *   help box  #3A3A3A, radius 12, `padding: 12px 16px`, 8 gap; text 14/21
 *             `.6`, links 15/22.5/600 #F6F6F6 with a 12px chevron 8 after
 *   detail    `rgba(255,255,255,.13)`, radius 8, `padding: 16px`, 56 tall
 *             16/20.8 textarea, caret #FF3B5C, `.4` placeholder; counter
 *             13/16.9 `.6`, right-aligned 8 below
 *   footer    `padding: 24px 16px`; Continue 52 pill #FE2C55 at `.4` until a
 *             reason is picked, Skip 52 tall text button 12 below, both
 *             16/20.8/500
 */
export function LeavingSurvey({
  username,
  onDeactivate,
  onGoToSection,
  onNext,
}: {
  username: string;
  onDeactivate: () => void;
  onGoToSection: (id: string) => void;
  onNext: () => void;
}) {
  const [picked, setPicked] = useState<number | null>(null);
  const [detail, setDetail] = useState("");
  const reasons = reasonsFor(username);

  return (
    <>
      <div className="flex-1 px-8 pt-6">
        <h1 className="mb-5 text-[24px] leading-9 font-bold text-[rgb(246_246_246)]">
          Before you go, can we help?
        </h1>
        <p className="mb-6 text-[15px] leading-[22.5px] text-[rgb(255_255_255/0.88)]">
          Let us know why you&apos;re thinking of leaving so we can help with common issues and
          improve the app for the community. You can skip this step.
        </p>

        <div role="radiogroup" aria-label="Why you're leaving">
          {reasons.map((reason, index) => (
            <div key={reason.label}>
              <ReasonOption
                label={reason.label}
                checked={picked === index}
                onPick={() => setPicked(index)}
              />
              {picked === index && index === TEMPORARY && (
                <HelpBox>
                  <p className="text-[14px] leading-[21px] text-[rgb(255_255_255/0.6)]">
                    If you might be back, consider deactivating your account. Deactivating allows
                    you to recover your account anytime. Deleting means you&rsquo;ll lose your
                    account and all content permanently after {DELETION_GRACE_DAYS} days.
                  </p>
                  <HelpLink onClick={onDeactivate}>Deactivate account</HelpLink>
                </HelpBox>
              )}
              {picked === index && reason.suggestions && (
                <HelpBox>
                  <p className="text-[14px] leading-[21px] text-[rgb(255_255_255/0.6)]">
                    The following may help:
                  </p>
                  {reason.suggestions.map(({ label, to }) =>
                    "href" in to ? (
                      <HelpLink key={label} href={to.href}>
                        {label}
                      </HelpLink>
                    ) : (
                      <HelpLink key={label} onClick={() => onGoToSection(to.section)}>
                        {label}
                      </HelpLink>
                    ),
                  )}
                </HelpBox>
              )}
              {picked === index && index === ANOTHER && (
                <div>
                  <div className="rounded-[8px] bg-[rgb(255_255_255/0.13)] p-4">
                    <textarea
                      value={detail}
                      onChange={(event) => setDetail(event.target.value.slice(0, MAX_DETAIL))}
                      maxLength={MAX_DETAIL}
                      placeholder="Provide as much detail as possible"
                      aria-label="Tell us more"
                      autoFocus
                      className="block h-14 w-full resize-none bg-transparent p-0.5 text-[16px] leading-[20.8px] text-[rgb(246_246_246)] caret-[rgb(255_59_92)] outline-none placeholder:text-[rgb(255_255_255/0.4)]"
                    />
                  </div>
                  <p className="mt-2 pr-1 text-right text-[13px] leading-[16.9px] text-[rgb(255_255_255/0.6)]">
                    {detail.length}/{MAX_DETAIL}
                  </p>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-3 px-4 py-6">
        <button
          type="button"
          onClick={onNext}
          disabled={picked === null}
          className="h-[52px] w-full rounded-full bg-[var(--tt-red)] px-6 text-[16px] leading-[20.8px] font-medium text-white transition-colors enabled:hover:bg-[var(--tt-red-hover)] disabled:cursor-not-allowed disabled:opacity-40"
        >
          Continue
        </button>
        <button
          type="button"
          onClick={onNext}
          className="h-[52px] w-full rounded-[8px] text-[16px] leading-[20.8px] font-medium text-[rgb(246_246_246)]"
        >
          Skip
        </button>
      </div>
    </>
  );
}

function ReasonOption({
  label,
  checked,
  onPick,
}: {
  label: string;
  checked: boolean;
  onPick: () => void;
}) {
  return (
    <label className="flex cursor-pointer items-center justify-between py-3">
      <span className="pr-3 text-[16px] leading-6 text-[rgb(246_246_246)]">{label}</span>
      <span className="relative flex h-[22px] w-[22px] flex-none">
        <input
          type="radio"
          name="leaving-reason"
          checked={checked}
          onChange={onPick}
          className="peer absolute inset-0 cursor-pointer opacity-0"
        />
        <span
          className={cn(
            "flex h-full w-full items-center justify-center rounded-full peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-white",
            checked ? "bg-[var(--tt-red)]" : "shadow-[inset_0_0_0_1.5px_rgb(255_255_255/0.32)]",
          )}
        >
          {checked && <span className="h-[9px] w-[9px] rounded-full bg-white" />}
        </span>
      </span>
    </label>
  );
}

function HelpBox({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col items-start gap-2 rounded-[12px] bg-[#3a3a3a] px-4 py-3">
      {children}
    </div>
  );
}

const HELP_LINK_CLASS =
  "flex items-center gap-2 text-left text-[15px] leading-[22.5px] font-semibold text-[rgb(246_246_246)]";

function HelpLink({
  children,
  href,
  onClick,
}: {
  children: React.ReactNode;
  href?: string;
  onClick?: () => void;
}) {
  const content = (
    <>
      {children}
      <ChevronRightIcon className="h-3 w-3 flex-none" />
    </>
  );

  return href ? (
    <Link href={href} className={HELP_LINK_CLASS}>
      {content}
    </Link>
  ) : (
    <button type="button" onClick={onClick} className={HELP_LINK_CLASS}>
      {content}
    </button>
  );
}

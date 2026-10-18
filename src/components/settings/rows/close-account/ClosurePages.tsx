"use client";

import { ChevronLeftIcon, ChevronRightIcon } from "@/components/icons";
import { DELETION_GRACE_DAYS } from "@/lib/account/closure";

export type Closure = "deactivate" | "delete";

/**
 * The pages that replace the Settings panel's sections once "Deactivate or
 * delete account" is clicked, as they do live — not a modal.
 *
 * Measured live at 1920px, in the 680-wide column of the 728 panel:
 *   header    52 tall, `padding: 4px 8px`, 40 × 44 back button with a 20px
 *             chevron, then a 0.5px `rgba(255,255,255,.19)` separator
 *   choose    `padding: 16px 32px`; title 24/36/700 #F6F6F6 + 20, intro
 *             16/24 `.88` + 24; cards #3A3A3A, radius 12, `padding: 16px`,
 *             8 apart, title 16/24/600 + 4, text 14/21 `.88`, 16px chevron
 *   info      `padding: 24px 32px`; title 20/25/700 `.9` + 16, body 14/18.2
 *             `.88`, disc list indented 16 with 8 under each item; the
 *             616 × 48 button, radius 8, 16/20.8/500 on #FE2C55, sits 24 off
 *             the bottom
 */
export function ClosureHeader({ onBack }: { onBack: () => void }) {
  return (
    <>
      <header className="flex h-[52px] items-center px-2 py-1">
        <button
          type="button"
          onClick={onBack}
          aria-label="Back"
          autoFocus
          className="flex h-11 w-10 items-center justify-center rounded-[6px] text-[rgb(246_246_246)]"
        >
          <ChevronLeftIcon className="h-5 w-5" />
        </button>
      </header>
      <div className="h-[0.5px] bg-[rgb(255_255_255/0.19)]" />
    </>
  );
}

const CHOICES: { value: Closure; title: string; description: string }[] = [
  {
    value: "deactivate",
    title: "Deactivate account",
    description:
      "No one can see your account, including all content that is stored in it. Reactivate your account and recover all content anytime.",
  },
  {
    value: "delete",
    title: "Delete account permanently",
    description: `Your account and content will be deleted permanently. You may cancel the deletion request by reactivating your account within ${DELETION_GRACE_DAYS} days.`,
  },
];

const INTRO = `If you want to leave Nowa temporarily, simply deactivate your account. If you choose to delete your account instead, you won't be able to recover it after ${DELETION_GRACE_DAYS} days.`;

export function ChoosePage({
  onChoose,
}: {
  onChoose: (closure: Closure) => void;
}) {
  return (
    <div className="px-8 py-4">
      <h1 className="mb-5 text-[24px] leading-9 font-bold text-[rgb(246_246_246)]">
        Delete or deactivate?
      </h1>
      <p className="mb-6 text-[16px] leading-6 text-[rgb(255_255_255/0.88)]">
        {INTRO}
      </p>
      <div className="flex flex-col gap-2">
        {CHOICES.map((choice) => (
          <button
            key={choice.value}
            type="button"
            onClick={() => onChoose(choice.value)}
            className="flex w-full items-start rounded-[12px] bg-[#3a3a3a] p-4 text-left"
          >
            <span className="mr-3 min-w-0 flex-1">
              <span className="mb-1 block text-[16px] leading-6 font-semibold text-[rgb(246_246_246)]">
                {choice.title}
              </span>
              <span className="block text-[14px] leading-[21px] text-[rgb(255_255_255/0.88)]">
                {choice.description}
              </span>
            </span>
            <ChevronRightIcon className="h-4 w-4 flex-none text-[rgb(255_255_255/0.9)]" />
          </button>
        ))}
      </div>
    </div>
  );
}

/**
 * Deactivate's copy is the live page's. Delete's live path is a leaving survey
 * and a data-download page, neither of which this app has anything behind, so
 * it gets the same page with what auth-service actually does on a delete.
 */
const INFO: Record<
  Closure,
  { question: string; lead: string; points: string[]; action: string }
> = {
  deactivate: {
    question: "Deactivate this account?",
    lead: "If you deactivate your account:",
    points: [
      "No one will see your account and content.",
      "Information that isn’t stored in your account, such as direct messages, may still be visible to others.",
      "Nowa will continue to keep your data so that you can recover it when you reactivate your account.",
      "You can reactivate your account and recover all content anytime by using the same login details.",
    ],
    action: "Deactivate",
  },
  delete: {
    question: "Delete this account?",
    lead: "If you delete your account:",
    points: [
      "Your account is deactivated right away, and no one will see your account and content.",
      `Your account and content will be deleted permanently after ${DELETION_GRACE_DAYS} days.`,
      `You can cancel the deletion request by logging in again within ${DELETION_GRACE_DAYS} days.`,
      "You’ll be logged out on every device.",
    ],
    action: "Delete account",
  },
};

export function InfoPage({
  closure,
  username,
  onConfirm,
}: {
  closure: Closure;
  username: string;
  onConfirm: () => void;
}) {
  const info = INFO[closure];

  return (
    <>
      <div className="flex-1 px-8 py-6">
        <h1 className="mb-4 text-[20px] leading-[25px] font-bold tracking-[0.3px] text-[rgb(255_255_255/0.9)]">
          {username}: {info.question}
        </h1>
        <div className="text-[14px] leading-[18.2px] text-[rgb(255_255_255/0.88)]">
          <p className="pb-2">{info.lead}</p>
          <ul className="mt-2 list-disc pl-4">
            {info.points.map((point) => (
              <li key={point} className="mb-2">
                {point}
              </li>
            ))}
          </ul>
        </div>
      </div>
      <div className="px-8 pb-6">
        <button
          type="button"
          onClick={onConfirm}
          className="h-12 w-full rounded-[8px] bg-[var(--tt-red)] px-6 text-[16px] leading-[20.8px] font-medium text-white transition-colors hover:bg-[var(--tt-red-hover)]"
        >
          {info.action}
        </button>
      </div>
    </>
  );
}

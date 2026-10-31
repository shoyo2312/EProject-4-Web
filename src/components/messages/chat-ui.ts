/**
 * The chat's shared look, in one place so a dialog, a notice and a button in different files cannot drift
 * apart. Colours and radii are the `--chat-*` tokens in `globals.css`; nothing here is a new value.
 */

/** A modal sheet: popup surface, the surface radius, a hairline and the pop shadow. Passed to `Modal`. */
export const DIALOG_SHEET =
  "w-[400px] rounded-[var(--chat-radius-surface)] border border-[var(--chat-line)] bg-[var(--chat-pop)] p-6 shadow-[var(--chat-shadow-pop)]";

const BUTTON =
  "h-11 rounded-[var(--chat-radius-control)] px-4 text-[15px] font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-default disabled:opacity-50";

/** Dismiss, Cancel, Delete: present but quiet. */
export const BUTTON_QUIET = `${BUTTON} bg-white/[0.08] text-[var(--tt-text)] hover:bg-white/[0.14] focus-visible:outline-white/70`;
/** The one action that moves on. */
export const BUTTON_PRIMARY = `${BUTTON} bg-white text-black hover:bg-white/90 focus-visible:outline-white`;
/** An action that cannot be taken back (block, delete): the brand red, solid. */
export const BUTTON_DANGER = `${BUTTON} bg-[var(--chat-own)] text-white hover:bg-[var(--chat-own-pressed)] focus-visible:outline-white`;

/** A card standing above the composer's place: notices that replace it (blocked, request sent). */
export const NOTICE_CARD =
  "rounded-[var(--chat-radius-surface)] border border-[var(--chat-line)] bg-[var(--chat-raised)]";

/** The round icon that opens a notice or a dialog option. */
export const ICON_DISC = "flex h-10 w-10 flex-none items-center justify-center rounded-full bg-white/[0.07] text-[var(--chat-meta)]";

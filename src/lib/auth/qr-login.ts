import type { QrLoginCreatedResponse, QrLoginStatusResponse } from "@/lib/api/types";

/** How often the page asks whether the code has been scanned. */
export const QR_POLL_INTERVAL_MS = 2000;

/** What the QR step shows. */
export type QrView =
  | { phase: "loading" }
  | { phase: "showing"; code: QrLoginCreatedResponse; scannedBy: string | null }
  | { phase: "approved" }
  | { phase: "expired" }
  | { phase: "rejected" }
  | { phase: "error"; message: string };

/**
 * Folds one poll answer into the view. An APPROVED answer without tokens is
 * treated as expired: the session it promised never arrived, so the only way
 * forward is a fresh code.
 */
export function nextQrView(view: QrView, answer: QrLoginStatusResponse): QrView {
  if (view.phase !== "showing") return view;
  switch (answer.status) {
    case "PENDING":
      return view.scannedBy === null ? view : { ...view, scannedBy: null };
    case "SCANNED":
      return { ...view, scannedBy: answer.username ?? view.scannedBy ?? "" };
    case "APPROVED":
      return answer.tokens ? { phase: "approved" } : { phase: "expired" };
    case "REJECTED":
      return { phase: "rejected" };
    case "EXPIRED":
      return { phase: "expired" };
  }
}

/**
 * Whether an unscanned code has run out, judged locally so the image greys out
 * on time without waiting for the next poll. A scanned code is left to the
 * server, which gives the phone extra time to confirm.
 */
export function hasLapsed(view: QrView, now: number): boolean {
  return (
    view.phase === "showing" &&
    view.scannedBy === null &&
    Date.parse(view.code.expiresAt) <= now
  );
}

import { isApiError } from "@/lib/api/errors";

/**
 * What a conversation report is made of on the client: the reasons it offers and the rules of the
 * message selection. admin-service validates the same labels (DirectMessageReports) and ranks them by
 * label, so they are stored verbatim and must not be reworded.
 */

export const REPORT_MAX_MESSAGES = 50;

export const CHAT_REPORT_REASONS = [
  "Nudity and sexual content",
  "Sextortion and intimate image abuse",
  "Regulated goods and activities",
  "Hate and harassment",
  "Frauds and scams",
  "Minor safety",
  "Misinformation",
  "Violence, abuse, and criminal exploitation",
  "Suicide and self-harm",
  "Disordered eating and unhealthy body image",
  "Shocking and graphic content",
  "Dangerous activities and challenges",
  "Deceptive behavior and spam",
  "Sharing personal information",
  "Dangerous goods or services",
  "Intellectual property infringement",
  "Advertisement does not match the item",
  "Other",
] as const;

export type ChatReportReason = (typeof CHAT_REPORT_REASONS)[number];

/** Message ids are Snowflakes: strings, never numbers. */
export type Selection = ReadonlySet<string>;

/**
 * Ticks or unticks one message. A 51st is refused and the same set comes back, so nothing already
 * picked is dropped to make room.
 */
export function toggleSelection(selected: Selection, id: string): { next: Selection; full: boolean } {
  if (selected.has(id)) {
    const next = new Set(selected);
    next.delete(id);
    return { next, full: false };
  }
  if (selected.size >= REPORT_MAX_MESSAGES) return { next: selected, full: true };
  return { next: new Set(selected).add(id), full: false };
}

/** A new submit's idempotency key: a retry of the same submit reuses it. */
export function newReportRequestId(): string {
  return globalThis.crypto.randomUUID();
}

/** What a refused or failed submit says; the selection and the reason stay so it can be sent again. */
export function reportErrorMessage(cause: unknown): string {
  if (isApiError(cause)) {
    switch (cause.code) {
      case "REPORT_EVIDENCE_UNAVAILABLE":
        return "Some selected messages can no longer be reported. Review your selection and try again.";
      case "NOT_CONVERSATION_PARTICIPANT":
      case "CONVERSATION_NOT_FOUND":
        return "This conversation isn't available.";
      case "CHAT_EVIDENCE_UNAVAILABLE":
        return "We couldn't read the conversation right now. Try again in a moment.";
      case "REPORT_ALREADY_SUBMITTED":
        return "This report is already being sent. Try again in a moment.";
    }
  }
  return "Couldn't send the report. Please try again.";
}

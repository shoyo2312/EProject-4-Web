/**
 * Facts the legal pages state about the service. Kept apart from the prose so
 * a change in the backend (a retention period, the support inbox) is one edit
 * here rather than a hunt through three pages.
 */

/** Routed by Cloudflare Email Routing; it receives mail but cannot send it. */
export const SUPPORT_EMAIL = "support@nowaa.site";

/** The date the current wording took effect. Bump it with any change to the text. */
export const LEGAL_LAST_UPDATED = "October 17, 2026";

/** auth-service `auth.retention.security-event-grace`. */
export const SECURITY_LOG_RETENTION_DAYS = 180;

/** video-service `video.trash.retention`. */
export const VIDEO_TRASH_RETENTION_DAYS = 30;

/** How long we allow ourselves to complete a deletion request. */
export const DELETION_REQUEST_DAYS = 30;

export const LEGAL_LINKS = {
  terms: "/terms",
  privacy: "/privacy",
  dataDeletion: "/data-deletion",
} as const;

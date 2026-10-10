/**
 * Each service's public "share this link" address, keyed by the share sheet's
 * target ids. No SDKs and no app ids: every one of these takes the link in the
 * query string and asks the reader to confirm on the service's own page.
 */
const INTENTS: Record<string, (url: string) => string> = {
  whatsapp: (url) => `https://wa.me/?text=${url}`,
  facebook: (url) => `https://www.facebook.com/sharer/sharer.php?u=${url}`,
  telegram: (url) => `https://t.me/share/url?url=${url}`,
  x: (url) => `https://x.com/intent/tweet?url=${url}`,
  linkedin: (url) => `https://www.linkedin.com/sharing/share-offsite/?url=${url}`,
  email: (url) => `mailto:?body=${url}`,
  reddit: (url) => `https://www.reddit.com/submit?url=${url}`,
  line: (url) => `https://social-plugins.line.me/lineit/share?url=${url}`,
};

/** Where sharing `link` to `targetId` goes, or null for a target with no intent. */
export function shareIntentUrl(targetId: string, link: string): string | null {
  return INTENTS[targetId]?.(encodeURIComponent(link)) ?? null;
}

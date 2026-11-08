import { LiveFeed } from "@/components/feed/LiveFeed";
import { loadGuestFeedPage } from "@/lib/api/guest-feed";

/** Kept in step with `GUEST_FEED_REVALIDATE_SECONDS` (a segment config must be a literal). */
export const revalidate = 30;

/**
 * "For You" — the default feed, served by video-service through the gateway.
 * `LiveFeed` does the fetching in the browser, because the session (and
 * therefore the token) only exists there. The one thing read here is the
 * signed-out feed's first page, handed down so a guest skips that request.
 */
export default async function Home() {
  return <LiveFeed guestPage={await loadGuestFeedPage()} />;
}

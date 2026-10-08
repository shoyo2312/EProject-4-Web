import { LiveFeed } from "@/components/feed/LiveFeed";

/**
 * "For You" — the default feed, served by video-service through the gateway.
 * `LiveFeed` does the fetching in the browser, because the session (and
 * therefore the token) only exists there.
 */
export default function Home() {
  return <LiveFeed />;
}

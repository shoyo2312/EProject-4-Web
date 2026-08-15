import { LiveFeed } from "@/components/feed/LiveFeed";
import { getFeedComments, getFeedVideos } from "@/lib/data";

/**
 * "For You" — the default feed, served by video-service through the gateway.
 *
 * The route stays a server component so the mock module never reaches the
 * client bundle; it hands the sample feed down as the offline fallback, and
 * `LiveFeed` does the fetching (the session, and therefore the token, only
 * exists in the browser).
 */
export default async function Home() {
  const [sampleVideos, sampleComments] = await Promise.all([
    getFeedVideos(),
    getFeedComments(),
  ]);

  return <LiveFeed sampleVideos={sampleVideos} sampleComments={sampleComments} />;
}

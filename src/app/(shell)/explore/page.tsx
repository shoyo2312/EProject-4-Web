import type { Metadata } from "next";

import { ExploreGrid } from "@/components/explore/ExploreGrid";
import { EXPLORE_CATEGORIES } from "@/lib/site-config";

export const metadata: Metadata = {
  title: "Explore - Find your favourite videos on Nowa",
  description:
    "Discover trending videos on Nowa by category — comedy, sports, food, animals, education and more.",
};

/**
 * "Explore" — the category-browsable grid. The sidebar, top bar and page chrome
 * come from `app/layout.tsx`; this route only owns the content column.
 *
 * `categories` is a fixed UI taxonomy, not video data (video-service has no
 * category concept — see `useExploreFeed`). The tiles are fetched client-side.
 */
export default function ExplorePage() {
  return <ExploreGrid categories={EXPLORE_CATEGORIES} />;
}

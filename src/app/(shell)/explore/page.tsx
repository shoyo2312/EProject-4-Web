import type { Metadata } from "next";

import { ExploreGrid } from "@/components/explore/ExploreGrid";
import { getExploreCategories } from "@/lib/data";

export const metadata: Metadata = {
  title: "Explore - Find your favourite videos on Nowa",
  description:
    "Discover trending videos on Nowa by category — comedy, sports, food, animals, education and more.",
};

/**
 * "Explore" — the category-browsable grid. The sidebar, top bar and page chrome
 * come from `app/layout.tsx`; this route only owns the content column.
 *
 * `categories` is the only server-fetched piece: it is a fixed UI taxonomy,
 * not video data (video-service has no category concept — see
 * `useExploreFeed`). The tiles themselves are fetched client-side.
 */
export default async function ExplorePage() {
  const categories = await getExploreCategories();

  return <ExploreGrid categories={categories} />;
}

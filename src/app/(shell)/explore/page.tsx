import type { Metadata } from "next";

import { ExploreGrid } from "@/components/explore/ExploreGrid";
import { getExploreCategories, getExploreItems } from "@/lib/data";

export const metadata: Metadata = {
  title: "Explore - Find your favourite videos on TikTok",
  description:
    "Discover trending videos on TikTok by category — comedy, sports, food, animals, education and more.",
};

/**
 * "Explore" — the category-browsable grid. The sidebar, top bar and page chrome
 * come from `app/layout.tsx`; this route only owns the content column.
 */
export default async function ExplorePage() {
  const [categories, items] = await Promise.all([
    getExploreCategories(),
    getExploreItems(),
  ]);

  return <ExploreGrid categories={categories} items={items} />;
}

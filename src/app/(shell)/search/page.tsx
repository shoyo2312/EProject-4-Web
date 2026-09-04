import type { Metadata } from "next";
import { Suspense } from "react";

import { SearchResults } from "@/components/search/SearchResults";

export const metadata: Metadata = {
  title: "Search - Find videos on Nowa",
  description: "Search Nowa videos by title, description or hashtag.",
};

/**
 * `/search?q=` — the results page the search drawer navigates to.
 *
 * `SearchResults` reads the query string, so it has to sit under a Suspense
 * boundary: `useSearchParams` opts a route out of static rendering otherwise,
 * and the build refuses it.
 */
export default function SearchPage() {
  return (
    <Suspense fallback={<main className="h-screen flex-1" />}>
      <SearchResults />
    </Suspense>
  );
}

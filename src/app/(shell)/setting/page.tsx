import type { Metadata } from "next";
import { Suspense } from "react";

import { SettingsPage } from "@/components/settings/SettingsPage";
import { SETTINGS_SECTIONS } from "@/lib/site-config";

export const metadata: Metadata = {
  title: "Privacy and Settings | Nowa",
};

/**
 * `/setting` — reached from the cog in the owner's profile header.
 *
 * Inside `(shell)` so it keeps the sidebar. The live page drops the sidebar for
 * a full-width header of its own; see `docs/research/tiktok.com/SETTINGS.md`
 * for why that one difference is not reproduced.
 *
 * `SettingsPage` reads the query string (`?summary=1`, from a weekly screen
 * time update), so it sits under a Suspense boundary: `useSearchParams` opts a
 * route out of static rendering otherwise, and the build refuses it.
 */
export default function SettingRoute() {
  return (
    <Suspense fallback={<main className="h-screen flex-1" />}>
      <SettingsPage sections={SETTINGS_SECTIONS} />
    </Suspense>
  );
}

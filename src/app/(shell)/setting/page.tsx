import type { Metadata } from "next";

import { SettingsPage } from "@/components/settings/SettingsPage";
import { getSettingsSections } from "@/lib/data";

export const metadata: Metadata = {
  title: "Privacy and Settings | Nowa",
};

/**
 * `/setting` — reached from the cog in the owner's profile header.
 *
 * Inside `(shell)` so it keeps the sidebar. The live page drops the sidebar for
 * a full-width header of its own; see `docs/research/tiktok.com/SETTINGS.md`
 * for why that one difference is not reproduced.
 */
export default async function SettingRoute() {
  const sections = await getSettingsSections();

  return <SettingsPage sections={sections} />;
}

import type { Metadata } from "next";

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
 */
export default function SettingRoute() {
  return <SettingsPage sections={SETTINGS_SECTIONS} />;
}

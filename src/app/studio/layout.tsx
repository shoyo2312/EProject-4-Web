import type { Metadata } from "next";

import { StudioShell } from "@/components/studio/StudioShell";

export const metadata: Metadata = { title: "Nowa Studio" };

/**
 * Outside `(shell)` on purpose: Studio replaces the feed's sidebar with its own,
 * the way tiktok.com/tiktokstudio leaves the feed behind.
 */
export default function StudioLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <StudioShell>{children}</StudioShell>;
}

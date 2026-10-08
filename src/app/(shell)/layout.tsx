import { SideNav } from "@/components/layout/SideNav";
import { FOOTER_SECTIONS, NAV_ITEMS } from "@/lib/site-config";

/**
 * The browsing shell: everything that sits beside the sidebar.
 *
 * It is a route group rather than the root layout because the single-video view
 * (`/video/[id]`) deliberately has no sidebar — the live site opens a video
 * full-bleed, with only the player, its details and the comments. Routes that
 * want the nav go inside `(shell)`; routes that want the whole width stay out.
 *
 * Rendered as a fragment so the placeholder stays a direct flex child of the
 * row in `app/layout.tsx`, exactly as the live DOM has it.
 */
export default function ShellLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <>
      {/* Placeholder reserves the sidebar's 240px; SideNav itself is fixed.
          It narrows with the rail, whether the breakpoint or the reader's
          toggle collapsed it — `.side-nav-collapsed` sits on SideNav's root —
          on the rail's own curve, so the page slides along with its edge. */}
      <div className="z-[99] h-screen w-[var(--side-nav-width)] flex-none transition-[width] duration-300 ease-[var(--tt-ease)] tt-1024:w-18 has-[.side-nav-collapsed]:w-18">
        <SideNav navItems={NAV_ITEMS} footerSections={FOOTER_SECTIONS} />
      </div>

      {children}
    </>
  );
}

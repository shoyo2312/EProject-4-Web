import { SideNav } from "@/components/layout/SideNav";
import { getActivity, getFooterSections, getNavItems } from "@/lib/data";

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
export default async function ShellLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const [navItems, footerSections, activity] = await Promise.all([
    getNavItems(),
    getFooterSections(),
    getActivity(),
  ]);

  return (
    <>
      {/* Placeholder reserves the sidebar's 240px; SideNav itself is fixed. */}
      <div className="z-[99] h-screen w-[var(--side-nav-width)] flex-none tt-1024:w-18">
        <SideNav
          navItems={navItems}
          footerSections={footerSections}
          activity={activity}
        />
      </div>

      {children}
    </>
  );
}

"use client";

import { useState } from "react";

import { cn } from "@/lib/utils";
import type { FooterSection } from "@/types/tiktok";

/**
 * `.DivFooterContainer` — extracted verbatim:
 *
 *   position: relative; padding-top: 16px; padding-left: 8px;
 *   ::before { content: ""; position: absolute; left: 8px; right: 8px; top: 0;
 *              height: 1px; background: rgba(255,255,255,.12);
 *              transform: scaleY(.5) }            ← a hairline, not a border
 *   @media screen and (max-width: 1071px) { display: none }
 *
 *   .H4LinkListHeader  15px/700/22px, TikTokDisplayFont, cursor: pointer,
 *                      margin-top: 5px (0 on the first), color .5 → .9 when
 *                      its section is open
 *   .DivLinkContainer  margin-bottom: 8px; children flow inline and wrap
 *   .StyledNavLink     12px/600/16px, rgba(255,255,255,.5), inline-block,
 *                      margin-right: 6px, margin-top: 5px; :hover keeps the
 *                      same colour and adds no underline
 *   .SpanCopyright     same type as the links, inline-block, margin-top: 5px
 *
 * It is a **single-open accordion that starts fully collapsed** — the link
 * lists are not in the DOM until their heading is clicked, and clicking an open
 * heading closes it. The 1071px breakpoint is its own; it is not 1024.
 */
export function SidebarFooter({
  sections,
  hidden,
}: {
  sections: FooterSection[];
  hidden: boolean;
}) {
  const [openSection, setOpenSection] = useState<string | null>(null);

  const toggle = (heading: string) =>
    setOpenSection((current) => (current === heading ? null : heading));

  return (
    <div
      className={cn(
        "relative pl-2 pt-4 tt-1071:hidden",
        "before:absolute before:inset-x-2 before:top-0 before:h-px",
        "before:bg-[var(--tt-divider)] before:[transform:scaleY(0.5)] before:content-['']",
        hidden && "hidden",
      )}
    >
      {sections.map((section, index) => {
        const open = openSection === section.heading;
        return (
          <div key={section.heading}>
            {/* The live site puts the handler on a bare `h3`. The tag is kept
                for fidelity, with role/tabIndex/keydown added so it is still
                operable from the keyboard. */}
            <h3
              role="button"
              tabIndex={0}
              aria-expanded={open}
              onClick={() => toggle(section.heading)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  toggle(section.heading);
                }
              }}
              className={cn(
                "cursor-pointer text-[15px] font-bold leading-[22px]",
                index === 0 ? "mt-0" : "mt-[5px]",
                open ? "text-[var(--tt-text)]" : "text-[var(--tt-text-muted)]",
              )}
            >
              {section.heading}
            </h3>

            {open && (
              <div className="mb-2">
                {section.links.map((link) => (
                  <span
                    key={link}
                    className="mr-1.5 mt-[5px] inline-block cursor-pointer text-[12px] font-semibold leading-4 text-[var(--tt-text-muted)]"
                  >
                    {link}
                  </span>
                ))}
              </div>
            )}
          </div>
        );
      })}

      <span className="mt-[5px] inline-block pb-6 text-[12px] font-semibold leading-4 text-[var(--tt-text-muted)]">
        © 2026 Nowa
      </span>
    </div>
  );
}

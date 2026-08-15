"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import {
  AccessibilityIcon,
  AdsIcon,
  ArrowLeftIcon,
  BusinessVerificationIcon,
  CaretDownIcon,
  ChevronRightIcon,
  ContentPreferencesIcon,
  ExternalLinkIcon,
  ManageAccountIcon,
  PrivacyLockIcon,
  PushNotificationsIcon,
  ScreenTimeIcon,
} from "@/components/icons";
import { cn } from "@/lib/utils";
import type {
  SettingsGroup,
  SettingsIconName,
  SettingsRow,
  SettingsSection,
} from "@/types/tiktok";

const ICONS: Record<SettingsIconName, typeof AdsIcon> = {
  "manage-account": ManageAccountIcon,
  privacy: PrivacyLockIcon,
  "push-notifications": PushNotificationsIcon,
  "business-verification": BusinessVerificationIcon,
  ads: AdsIcon,
  "screen-time": ScreenTimeIcon,
  "content-preferences": ContentPreferencesIcon,
  accessibility: AccessibilityIcon,
};

/**
 * `.DivSettingContainer` — the settings card: a nav rail beside one long
 * scrolling panel that holds every section.
 *
 * Measured live at 1920px (see `docs/research/tiktok.com/SETTINGS.md`):
 *   layout   1100 wide, centred, `padding-top: 16px`; nav 356, panel 728,
 *            16px apart, both #252525 with `border-radius: 8px 8px 0 0`
 *   back     40px disc, absolute, 61px left of the card
 *   nav item 356 × 52, `padding: 14px 24px`, 24px glyph + 12px gap,
 *            label 18/27/600, active #FE2C55 with no pill behind it
 *   panel    `padding: 16px 24px 24px`, sections 680 wide, 32px apart, and
 *            **the panel is what scrolls** — the window does not
 *
 * The nav is not a set of links: clicking scrolls the panel, and scrolling the
 * panel moves the highlight, so the two stay in step from either end.
 */
export function SettingsPage({ sections }: { sections: SettingsSection[] }) {
  const router = useRouter();
  const panelRef = useRef<HTMLDivElement>(null);
  const sectionRefs = useRef(new Map<string, HTMLElement>());
  const [active, setActive] = useState(sections[0]?.id ?? "");

  /**
   * A click sets the highlight itself and holds it there until the smooth
   * scroll lands — otherwise the sections it flies past would each claim it on
   * the way down.
   */
  const scrollLock = useRef(false);

  const onScroll = useCallback(() => {
    const panel = panelRef.current;
    if (!panel || scrollLock.current) return;

    // The last section whose top has passed the panel's top edge. Measured
    // from the rects rather than `offsetTop`, which would be relative to
    // whichever ancestor happens to be positioned.
    const top = panel.getBoundingClientRect().top;
    let current = sections[0]?.id ?? "";
    for (const section of sections) {
      const element = sectionRefs.current.get(section.id);
      if (!element) continue;
      if (element.getBoundingClientRect().top - top <= 24) current = section.id;
    }
    setActive(current);
  }, [sections]);

  useEffect(() => {
    const panel = panelRef.current;
    if (!panel) return;
    panel.addEventListener("scroll", onScroll, { passive: true });
    return () => panel.removeEventListener("scroll", onScroll);
  }, [onScroll]);

  const goTo = (id: string) => {
    const panel = panelRef.current;
    const element = sectionRefs.current.get(id);
    if (!panel || !element) return;

    setActive(id);
    scrollLock.current = true;
    const delta =
      element.getBoundingClientRect().top - panel.getBoundingClientRect().top;
    const target = Math.min(
      panel.scrollTop + delta,
      panel.scrollHeight - panel.clientHeight,
    );

    const from = panel.scrollTop;
    panel.scrollTo({ top: target, behavior: "smooth" });

    // Some browsers (and every profile with smooth scrolling switched off)
    // drop the request entirely instead of jumping, which would leave the nav
    // highlighting a section the reader never reached. Land it by hand if
    // nothing has moved by the next frame.
    requestAnimationFrame(() => {
      if (panel.scrollTop === from && target !== from) panel.scrollTop = target;
    });

    window.setTimeout(() => {
      scrollLock.current = false;
    }, 600);
  };

  return (
    <main className="relative h-screen flex-1 overflow-hidden">
      <button
        type="button"
        onClick={() => router.back()}
        aria-label="Back"
        className="absolute top-8 left-[max(0.75rem,calc(50%-611px))] flex h-10 w-10 items-center justify-center rounded-full text-[var(--tt-text)] transition-colors hover:bg-[var(--tt-field)]"
      >
        <ArrowLeftIcon className="h-5 w-5" />
      </button>

      {/* Exactly 1100 = nav 356 + 16 + panel 728, with no padding of its own —
          the card is flush with that width on the live page. */}
      <div className="mx-auto flex h-full w-full max-w-[1100px] gap-4 pt-4 tt-1200:px-3">
        <nav className="w-[356px] flex-none rounded-t-[8px] bg-[#252525] py-4 tt-840:hidden">
          {sections.map((section) => {
            const Icon = ICONS[section.icon];
            const on = section.id === active;
            return (
              <button
                key={section.id}
                type="button"
                onClick={() => goTo(section.id)}
                aria-current={on ? "true" : undefined}
                className={cn(
                  "flex h-13 w-full items-center gap-3 px-6 text-left text-[18px] leading-[27px] font-semibold transition-colors",
                  on
                    ? "text-[var(--tt-red)]"
                    : "text-[var(--tt-text)] hover:text-[var(--tt-red)]",
                )}
              >
                <Icon className="h-6 w-6 flex-none" />
                <span className="truncate">{section.label}</span>
              </button>
            );
          })}
        </nav>

        <div
          ref={panelRef}
          className="min-w-0 flex-1 overflow-y-auto rounded-t-[8px] bg-[#252525] px-6 pt-4 pb-6"
        >
          {sections.map((section, index) => (
            <section
              key={section.id}
              ref={(node) => {
                if (node) sectionRefs.current.set(section.id, node);
                else sectionRefs.current.delete(section.id);
              }}
              className={cn("pb-4", index > 0 && "mt-8")}
            >
              <h1 className="mx-2 mb-7 text-[24px] leading-8 font-bold text-[var(--tt-text)]">
                {section.label}
              </h1>

              {section.groups.map((group, groupIndex) => (
                <Group key={group.heading ?? groupIndex} group={group} />
              ))}
            </section>
          ))}
        </div>
      </div>
    </main>
  );
}

function Group({ group }: { group: SettingsGroup }) {
  return (
    <div className="mb-4">
      {group.heading && (
        <h2
          className={cn(
            "text-[18px] leading-6",
            group.muted
              ? "font-medium text-[rgb(255_255_255/0.6)]"
              : "mx-4 font-semibold text-[var(--tt-text)]",
          )}
        >
          {group.heading}
        </h2>
      )}
      {group.description && (
        <p className="mx-4 mt-0.5 text-[12px] leading-[15px] text-[rgb(255_255_255/0.6)]">
          {group.description}
        </p>
      )}

      <div className="mt-3">
        {group.rows.map((row) => (
          <Row key={row.title} row={row} />
        ))}
      </div>
    </div>
  );
}

const ROW_CLASS =
  "flex w-full items-center gap-4 border-b border-[var(--tt-divider)] px-4 py-3 text-left last:border-b-0";

/**
 * One row: title over an optional description, with the accessory that says
 * what the row does. `switch` is the only kind that changes anything — the
 * others are the entry points to flows this clone has no screens for, so they
 * are rendered exactly and left inert.
 */
function Row({ row }: { row: SettingsRow }) {
  const [on, setOn] = useState(row.kind === "switch" && row.on);

  const body = (
    <div className="min-w-0 flex-1">
      <p className="text-[16px] leading-[21px] text-[var(--tt-text)]">
        {row.title}
      </p>
      {row.description && (
        <p className="mt-1 max-w-[583px] text-[12px] leading-[15.6px] text-[rgb(255_255_255/0.6)]">
          {row.description}
        </p>
      )}
    </div>
  );

  // On the live page the switch is the only hit area in its row; every other
  // kind makes the whole row clickable.
  if (row.kind === "switch") {
    return (
      <div className={ROW_CLASS}>
        {body}
        <Switch on={on} label={row.title} onToggle={() => setOn((w) => !w)} />
      </div>
    );
  }

  return (
    <button type="button" className={cn(ROW_CLASS, "hover:bg-white/[0.03]")}>
      {body}
      <Accessory row={row} />
    </button>
  );
}

function Accessory({ row }: { row: SettingsRow }) {
  if (row.kind === "expand") {
    return (
      <CaretDownIcon className="h-4 w-4 flex-none text-[rgb(255_255_255/0.6)]" />
    );
  }

  if (row.kind === "external") {
    return (
      <ExternalLinkIcon className="h-4 w-4 flex-none text-[var(--tt-red)]" />
    );
  }

  return (
    <div className="flex flex-none items-center gap-2">
      {row.kind === "value" && (
        <span className="text-[16px] leading-[20.8px] text-[rgb(255_255_255/0.6)]">
          {row.value}
        </span>
      )}
      <ChevronRightIcon className="h-4 w-4 text-[rgb(255_255_255/0.6)]" />
    </div>
  );
}

/**
 * `.DivSwitchWrapper` — 44 × 24 track, 20px knob inset 2px, `#0BE09B` when on.
 * Green, not the brand red: `/setting` is the only page in the app using it.
 */
function Switch({
  on,
  label,
  onToggle,
}: {
  on: boolean;
  label: string;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={onToggle}
      className={cn(
        "flex h-6 w-11 flex-none items-center rounded-full p-0.5 transition-colors",
        on ? "bg-[#0be09b]" : "bg-white/[0.12]",
      )}
    >
      <span
        className={cn(
          "h-5 w-5 rounded-full bg-white shadow-[0_1px_2px_rgba(0,0,0,0.15)] transition-transform",
          on && "translate-x-5",
        )}
      />
    </button>
  );
}

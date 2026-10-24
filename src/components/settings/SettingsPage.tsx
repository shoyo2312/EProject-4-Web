"use client";

import { useRouter, useSearchParams } from "next/navigation";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";

import { AccountListModal } from "@/components/settings/AccountListModal";
import {
  AccountSwitchRow,
  AudienceRow,
  CommentFiltersRow,
  SleepHoursRow,
} from "@/components/settings/rows/AccountRows";
import { AddEmailRow } from "@/components/settings/rows/AddEmailModal";
import { PreferenceExpandRow } from "@/components/settings/rows/NotificationPreferenceRows";
import { ScreenTimeSummaryRow } from "@/components/settings/rows/ScreenTimeSummary";
import {
  DailyScreenTimePage,
  DailyScreenTimeRow,
} from "@/components/settings/rows/screen-time/DailyScreenTimePage";
import {
  CloseAccountPanel,
  CloseAccountRow,
} from "@/components/settings/rows/CloseAccountModal";
import { PasswordRow } from "@/components/settings/rows/PasswordModal";
import {
  DownloadDataPanel,
  DownloadDataRow,
} from "@/components/settings/rows/download-data/DownloadDataPanel";
import {
  Accessory,
  ROW_CLASS,
  RowBody,
  Switch,
} from "@/components/settings/rows/parts";
import {
  type AccountSettings,
  useAccountSettings,
} from "@/hooks/use-account-settings";
import { useBrowserNotifications } from "@/hooks/use-browser-notifications";
import { useLocalSettings } from "@/hooks/use-local-settings";
import { setHighContrast } from "@/lib/settings/local-settings";
import {
  IN_APP_SWITCHES,
  PUSH_SWITCHES,
} from "@/lib/settings/notification-preferences";
import { toast } from "@/components/ui/toast";
import {
  AccessibilityIcon,
  ArrowLeftIcon,
  ContentPreferencesIcon,
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

/** A switch row, narrowed — the three below each own one. */
type SwitchSettingsRow = Extract<SettingsRow, { kind: "switch" }>;

/** The pages that take over the panel in place of the sections. */
type Subpage = "close-account" | "download-data" | "daily-screen-time";

/** Screen time → Summary, which a weekly update in the inbox opens. */
const SUMMARY_TITLE = "Summary";

const ICONS: Record<SettingsIconName, typeof ManageAccountIcon> = {
  "manage-account": ManageAccountIcon,
  privacy: PrivacyLockIcon,
  "push-notifications": PushNotificationsIcon,
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
 *
 * "Deactivate or delete account" and "Download your data" swap the sections
 * for their own pages, as they do live. The sections stay mounted underneath,
 * and the panel comes back to where it was scrolled.
 */
export function SettingsPage({ sections }: { sections: SettingsSection[] }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const account = useAccountSettings();
  const panelRef = useRef<HTMLDivElement>(null);
  const sectionRefs = useRef(new Map<string, HTMLElement>());
  const [active, setActive] = useState(sections[0]?.id ?? "");
  const [subpage, setSubpage] = useState<Subpage | null>(null);
  /** The title of the one row open in place, as on the live panel. */
  const [openExpand, setOpenExpand] = useState<string | null>(null);
  const subpageRef = useRef(false);
  const savedScroll = useRef(0);
  const pendingSection = useRef<string | null>(null);

  /**
   * A click sets the highlight itself and holds it there until the smooth
   * scroll lands — otherwise the sections it flies past would each claim it on
   * the way down.
   */
  const scrollLock = useRef(false);

  const onScroll = useCallback(() => {
    const panel = panelRef.current;
    if (!panel || scrollLock.current || subpageRef.current) return;

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

  const openSubpage = (page: Subpage) => {
    // From one page straight to another, the sections' scroll is already saved.
    if (!subpageRef.current) savedScroll.current = panelRef.current?.scrollTop ?? 0;
    subpageRef.current = true;
    setSubpage(page);
  };

  const leaveSubpage = useCallback(() => setSubpage(null), []);

  // Before paint, so the sections never flash at the top of the panel.
  useLayoutEffect(() => {
    const panel = panelRef.current;
    if (!panel) return;
    if (subpage) {
      panel.scrollTop = 0;
      return;
    }
    if (!subpageRef.current) return;
    subpageRef.current = false;
    panel.scrollTop = savedScroll.current;
    const section = pendingSection.current;
    pendingSection.current = null;
    if (section) goTo(section);
  }, [subpage]);

  const onNav = (id: string) => {
    if (!subpage) return goTo(id);
    pendingSection.current = id;
    setSubpage(null);
  };

  // A weekly screen time update in the inbox links to `?summary=1`: open the
  // Summary chart — during render, the way a prop change adjusts state — then
  // scroll to it and spend the link, so the next one opens it again even when
  // it arrives with the page already showing.
  const summaryRequested = searchParams.get("summary") === "1";
  const [summaryOpened, setSummaryOpened] = useState(false);
  if (summaryRequested !== summaryOpened) {
    setSummaryOpened(summaryRequested);
    if (summaryRequested) setOpenExpand(SUMMARY_TITLE);
  }
  useEffect(() => {
    if (!summaryRequested) return;
    // Next frame, once the opened chart is laid out.
    requestAnimationFrame(() => {
      goTo("screen-time");
      router.replace("/setting", { scroll: false });
    });
  }, [summaryRequested, router]);

  return (
    <main className="relative h-screen flex-1 overflow-hidden">
      {/* Live, each page in the panel is a route under /setting, so the arrow
          leaves it for the sections before it leaves the settings. */}
      <button
        type="button"
        onClick={() => (subpage ? leaveSubpage() : router.back())}
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
                onClick={() => onNav(section.id)}
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
          className="no-scrollbar min-w-0 flex-1 overflow-y-auto rounded-t-[8px] bg-[#252525] px-6 pt-4 pb-6"
        >
          {subpage === "close-account" && (
            <CloseAccountPanel
              onBack={leaveSubpage}
              onGoToSection={onNav}
              onRequestDownload={() => openSubpage("download-data")}
            />
          )}
          {subpage === "download-data" && <DownloadDataPanel onLeave={leaveSubpage} />}
          {subpage === "daily-screen-time" && (
            <DailyScreenTimePage account={account} onLeave={leaveSubpage} />
          )}
          <div className={cn(subpage && "hidden")}>
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
                  <Group
                    key={group.heading ?? groupIndex}
                    group={group}
                    account={account}
                    onOpen={openSubpage}
                    openExpand={openExpand}
                    onToggleExpand={(title) =>
                      setOpenExpand((open) => (open === title ? null : title))
                    }
                  />
                ))}
              </section>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}

function Group({
  group,
  account,
  onOpen,
  openExpand,
  onToggleExpand,
}: {
  group: SettingsGroup;
  account: AccountSettings;
  onOpen: (page: Subpage) => void;
  openExpand: string | null;
  onToggleExpand: (title: string) => void;
}) {
  return (
    <div className="mb-4">
      {group.heading && (
        <h2 className="mx-4 text-[18px] leading-6 font-semibold text-[var(--tt-text)]">
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
          <Row
            key={row.title}
            row={row}
            account={account}
            onOpen={onOpen}
            expanded={openExpand === row.title}
            onToggle={() => onToggleExpand(row.title)}
          />
        ))}
      </div>
    </div>
  );
}

/**
 * One row, dispatched on `row.action`.
 *
 * A row without an action is still rendered exactly and left inert: it is the
 * entry point to a flow whose state no backend service stores yet, and a
 * control that pretends to save something is worse than one that visibly does
 * nothing. The wired ones need a hook each, so each is its own component
 * rather than a branch inside one.
 */
function Row({
  row,
  account,
  onOpen,
  expanded,
  onToggle,
}: {
  row: SettingsRow;
  account: AccountSettings;
  onOpen: (page: Subpage) => void;
  expanded: boolean;
  onToggle: () => void;
}) {
  if (row.kind === "expand") {
    switch (row.action) {
      case "push-preferences":
        return (
          <PreferenceExpandRow
            row={row}
            account={account}
            expanded={expanded}
            onToggle={onToggle}
            switches={PUSH_SWITCHES}
          />
        );
      case "in-app-preferences":
        return (
          <PreferenceExpandRow
            row={row}
            account={account}
            expanded={expanded}
            onToggle={onToggle}
            switches={IN_APP_SWITCHES}
          />
        );
      case "screen-time-summary":
        return <ScreenTimeSummaryRow row={row} expanded={expanded} onToggle={onToggle} />;
    }
  }

  if (row.kind === "switch") {
    switch (row.action) {
      case "high-contrast":
        return <HighContrastRow row={row} />;
      case "browser-notifications":
        return <BrowserNotificationsRow row={row} />;
      case "private-account":
        return (
          <AccountSwitchRow
            row={row}
            account={account}
            field="privateAccount"
          />
        );
      case "weekly-screen-time":
        return (
          <AccountSwitchRow
            row={row}
            account={account}
            field="weeklyScreenTimeDigest"
          />
        );
      default:
        return null;
    }
  }

  switch (row.action) {
    case "blocked-accounts":
      return <AccountListRow row={row} kind="blocked" />;
    case "muted-accounts":
      return <AccountListRow row={row} kind="muted" />;
    case "comment-audience":
      return (
        <AudienceRow row={row} account={account} field="commentAudience" />
      );
    case "comment-filters":
      return <CommentFiltersRow row={row} account={account} />;
    case "dm-audience":
      return <AudienceRow row={row} account={account} field="dmAudience" />;
    case "screen-time-limit":
      return (
        <DailyScreenTimeRow
          row={row}
          account={account}
          onOpen={() => onOpen("daily-screen-time")}
        />
      );
    case "sleep-hours":
      return <SleepHoursRow row={row} account={account} />;
    case "add-email":
      return <AddEmailRow row={row} />;
    case "password":
      return <PasswordRow row={row} />;
    case "close-account":
      return <CloseAccountRow row={row} onOpen={() => onOpen("close-account")} />;
    case "download-data":
      return <DownloadDataRow row={row} onOpen={() => onOpen("download-data")} />;
  }

  return (
    <button type="button" className={cn(ROW_CLASS, "hover:bg-white/[0.03]")}>
      <RowBody row={row} />
      <Accessory row={row} />
    </button>
  );
}

/** Accessibility → "Increase color contrast". Browser-local, by its own copy. */
function HighContrastRow({ row }: { row: SwitchSettingsRow }) {
  const { highContrast } = useLocalSettings();

  return (
    <div className={ROW_CLASS}>
      <RowBody row={row} />
      <Switch
        on={highContrast}
        label={row.title}
        onToggle={() => setHighContrast(!highContrast)}
      />
    </div>
  );
}

/**
 * Push notifications → "Allow in browser".
 *
 * Nothing is registered with a push service: this gates the desktop
 * notification `useNotifications` raises for a frame already arriving over the
 * STOMP socket. Real pushes to a closed tab need FCM web credentials and a
 * `platform` field notification-service's `DeviceToken` does not have yet.
 */
function BrowserNotificationsRow({ row }: { row: SwitchSettingsRow }) {
  const { on, blocked, unsupported, toggle } = useBrowserNotifications();

  const onToggle = () => {
    void toggle().then((problem) => {
      if (problem) toast.error(problem);
    });
  };

  return (
    <div className={ROW_CLASS}>
      <RowBody
        row={row}
        note={
          unsupported
            ? "This browser cannot show desktop notifications."
            : blocked
              ? "Blocked in your browser settings."
              : undefined
        }
      />
      <Switch
        on={on}
        label={row.title}
        onToggle={onToggle}
        disabled={unsupported}
      />
    </div>
  );
}

/** Privacy → "Blocked accounts" / "Muted accounts". The dialog portals itself out of this row. */
function AccountListRow({
  row,
  kind,
}: {
  row: SettingsRow;
  kind: "blocked" | "muted";
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(ROW_CLASS, "hover:bg-white/[0.03]")}
      >
        <RowBody row={row} />
        <Accessory row={row} />
      </button>
      {open && <AccountListModal kind={kind} onClose={() => setOpen(false)} />}
    </>
  );
}

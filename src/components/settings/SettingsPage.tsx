"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import { AccountListModal } from "@/components/settings/AccountListModal";
import {
  AccountSwitchRow,
  AudienceRow,
  ScreenTimeLimitRow,
  SleepHoursRow,
} from "@/components/settings/rows/AccountRows";
import { AddEmailRow } from "@/components/settings/rows/AddEmailModal";
import { PasswordRow } from "@/components/settings/rows/PasswordModal";
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
import { toast } from "@/components/ui/toast";
import {
  AccessibilityIcon,
  ArrowLeftIcon,
  BusinessVerificationIcon,
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

const ICONS: Record<SettingsIconName, typeof ManageAccountIcon> = {
  "manage-account": ManageAccountIcon,
  privacy: PrivacyLockIcon,
  "push-notifications": PushNotificationsIcon,
  "business-verification": BusinessVerificationIcon,
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
  const account = useAccountSettings();
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
          className="no-scrollbar min-w-0 flex-1 overflow-y-auto rounded-t-[8px] bg-[#252525] px-6 pt-4 pb-6"
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
                <Group
                  key={group.heading ?? groupIndex}
                  group={group}
                  account={account}
                />
              ))}
            </section>
          ))}
        </div>
      </div>
    </main>
  );
}

function Group({
  group,
  account,
}: {
  group: SettingsGroup;
  account: AccountSettings;
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
          <Row key={row.title} row={row} account={account} />
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
function Row({ row, account }: { row: SettingsRow; account: AccountSettings }) {
  if (row.kind === "switch") {
    switch (row.action) {
      case "high-contrast":
        return <HighContrastRow row={row} />;
      case "browser-notifications":
        return <BrowserNotificationsRow row={row} />;
      case "private-account":
        return <AccountSwitchRow row={row} account={account} field="privateAccount" />;
      case "weekly-screen-time":
        return <AccountSwitchRow row={row} account={account} field="weeklyScreenTimeDigest" />;
      default:
        return <SessionSwitchRow row={row} />;
    }
  }

  switch (row.action) {
    case "blocked-accounts":
      return <AccountListRow row={row} kind="blocked" />;
    case "muted-accounts":
      return <AccountListRow row={row} kind="muted" />;
    case "comment-audience":
      return <AudienceRow row={row} account={account} field="commentAudience" />;
    case "dm-audience":
      return <AudienceRow row={row} account={account} field="dmAudience" />;
    case "screen-time-limit":
      return <ScreenTimeLimitRow row={row} account={account} />;
    case "sleep-hours":
      return <SleepHoursRow row={row} account={account} />;
    case "add-email":
      return <AddEmailRow row={row} />;
    case "password":
      return <PasswordRow row={row} />;
  }

  return (
    <button type="button" className={cn(ROW_CLASS, "hover:bg-white/[0.03]")}>
      <RowBody row={row} />
      <Accessory row={row} />
    </button>
  );
}

/**
 * The unwired switch — business verification. It holds its position for the
 * session and is forgotten on reload, which is the honest rendering of a
 * control with nowhere to save to.
 */
function SessionSwitchRow({ row }: { row: SwitchSettingsRow }) {
  const [on, setOn] = useState(row.on);

  return (
    <div className={ROW_CLASS}>
      <RowBody row={row} />
      <Switch on={on} label={row.title} onToggle={() => setOn((w) => !w)} />
    </div>
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
function AccountListRow({ row, kind }: { row: SettingsRow; kind: "blocked" | "muted" }) {
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

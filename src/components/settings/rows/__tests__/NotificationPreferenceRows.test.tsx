import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { PreferenceExpandRow } from "@/components/settings/rows/NotificationPreferenceRows";
import type { AccountSettings } from "@/hooks/use-account-settings";
import type { UserSettingsResponse } from "@/lib/api/types";
import { IN_APP_SWITCHES, PUSH_SWITCHES } from "@/lib/settings/notification-preferences";
import type { SettingsRow } from "@/types/tiktok";

vi.mock("@/components/ui/toast", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
vi.mock("@/components/session/SessionProvider", () => ({
  useSession: () => ({ requireSignIn: () => true }),
}));

const settings: UserSettingsResponse = {
  commentAudience: "EVERYONE",
  dmAudience: "EVERYONE",
  screenTimeLimitMinutes: null,
  screenTimeLimitsByDay: null,
  hasScreenTimePasscode: false,
  sleepHoursStart: null,
  sleepHoursEnd: null,
  weeklyScreenTimeDigest: true,
  privateAccount: false,
  filterSpamOffensive: true,
  filterAllComments: false,
  commentKeywords: [],
  pushLikes: true,
  pushComments: true,
  pushNewFollowers: true,
  inAppLikes: true,
  inAppComments: true,
  inAppNewFollowers: true,
  inAppReposts: true,
  timeZone: null,
};

const interactions: SettingsRow = {
  kind: "expand",
  title: "Interactions",
  description: "Likes, comments, new followers",
  action: "push-preferences",
};

const inApp: SettingsRow = {
  kind: "expand",
  title: "In-app notifications",
  heading: true,
  action: "in-app-preferences",
};

function account(): AccountSettings {
  return { settings, update: vi.fn<AccountSettings["update"]>(async () => {}) };
}

afterEach(cleanup);

describe("PreferenceExpandRow", () => {
  it("shows the three push switches when expanded", () => {
    render(
      <PreferenceExpandRow
        row={interactions}
        account={account()}
        expanded
        onToggle={() => {}}
        switches={PUSH_SWITCHES}
      />,
    );

    expect(screen.getAllByRole("switch").map((s) => s.getAttribute("aria-label"))).toEqual([
      "Likes",
      "Comments",
      "New followers",
    ]);
    expect(screen.queryByText(/Mentions/)).toBeNull();
  });

  it("saves a switch on the tap", async () => {
    const viewer = account();
    render(
      <PreferenceExpandRow
        row={interactions}
        account={viewer}
        expanded
        onToggle={() => {}}
        switches={PUSH_SWITCHES}
      />,
    );

    await act(async () => {
      fireEvent.click(screen.getByRole("switch", { name: "Likes" }));
    });

    expect(viewer.update).toHaveBeenCalledWith({ pushLikes: false });
  });

  it("opening In-app closes Interactions", () => {
    function TwoRows() {
      const [open, setOpen] = useState<string | null>("Interactions");
      const toggle = (title: string) => () =>
        setOpen((current) => (current === title ? null : title));
      const viewer = account();
      return (
        <>
          <PreferenceExpandRow
            row={interactions}
            account={viewer}
            expanded={open === interactions.title}
            onToggle={toggle(interactions.title)}
            switches={PUSH_SWITCHES}
          />
          <PreferenceExpandRow
            row={inApp}
            account={viewer}
            expanded={open === inApp.title}
            onToggle={toggle(inApp.title)}
            switches={IN_APP_SWITCHES}
          />
        </>
      );
    }
    render(<TwoRows />);

    fireEvent.click(screen.getByRole("button", { name: /In-app notifications/ }));

    expect(
      screen.getByRole("button", { name: /Interactions/ }).getAttribute("aria-expanded"),
    ).toBe("false");
    expect(
      screen.getByRole("button", { name: /In-app notifications/ }).getAttribute("aria-expanded"),
    ).toBe("true");
    expect(screen.getAllByRole("switch")).toHaveLength(4);
  });

  it("lists Reposts only in-app", () => {
    expect(PUSH_SWITCHES.map((s) => s.label)).not.toContain("Reposts");
    expect(IN_APP_SWITCHES.map((s) => s.label)).toEqual([
      "Likes",
      "Comments",
      "New followers",
      "Reposts",
    ]);
  });
});

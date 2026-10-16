import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";

import { CommentFiltersModal } from "@/components/settings/rows/CommentFiltersModal";
import type { AccountSettings } from "@/hooks/use-account-settings";
import type { UserSettingsResponse } from "@/lib/api/types";

vi.mock("@/components/ui/toast", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

const settings: UserSettingsResponse = {
  commentAudience: "EVERYONE",
  dmAudience: "EVERYONE",
  screenTimeLimitMinutes: null,
  sleepHoursStart: null,
  sleepHoursEnd: null,
  weeklyScreenTimeDigest: true,
  privateAccount: false,
  filterSpamOffensive: true,
  filterAllComments: false,
  commentKeywords: ["giảm giá"],
};

afterEach(cleanup);

function renderModal() {
  const update = vi.fn<AccountSettings["update"]>(async () => {});
  render(<CommentFiltersModal settings={settings} update={update} onClose={() => {}} />);
  return update;
}

async function addKeyword(text: string) {
  fireEvent.change(screen.getByRole("textbox", { name: "Add a keyword" }), {
    target: { value: text },
  });
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: "Add" }));
  });
}

describe("CommentFiltersModal", () => {
  it("saves a switch on the tap", () => {
    const update = renderModal();

    fireEvent.click(screen.getByRole("switch", { name: "Filter all comments" }));

    expect(update).toHaveBeenCalledWith({ filterAllComments: true });
  });

  it("sends the whole list with the new keyword on the end, then clears the box", async () => {
    const update = renderModal();

    await addKeyword(" spoiler ");

    expect(update).toHaveBeenCalledWith({ commentKeywords: ["giảm giá", "spoiler"] });
    expect(screen.getByRole<HTMLInputElement>("textbox", { name: "Add a keyword" }).value).toBe("");
  });

  it("sends the list without a keyword that is removed", () => {
    const update = renderModal();

    fireEvent.click(screen.getByRole("button", { name: "Remove giảm giá" }));

    expect(update).toHaveBeenCalledWith({ commentKeywords: [] });
  });

  it("says a keyword is already filtered instead of sending it again", async () => {
    const update = renderModal();

    await addKeyword("Giảm Giá");

    expect(screen.getByText("You already filter this keyword.")).toBeTruthy();
    expect(update).not.toHaveBeenCalled();
  });
});

import { describe, expect, it } from "vitest";

import { groupByDay } from "../use-notifications";
import type { NotificationResponse } from "@/lib/api/notifications";

function at(iso: string, id = iso): NotificationResponse {
  return {
    id,
    actorId: "9",
    type: "LIKE",
    title: "t",
    body: "b",
    referenceId: "7",
    read: false,
    createdAt: iso,
  };
}

const now = new Date(2026, 8, 20, 10, 0); // 20 Sep 2026, local

describe("groupByDay", () => {
  it("labels today, yesterday and older days", () => {
    const groups = groupByDay(
      [
        at(new Date(2026, 8, 20, 9, 0).toISOString(), "today"),
        at(new Date(2026, 8, 19, 23, 50).toISOString(), "yesterday"),
        at(new Date(2026, 8, 12, 8, 0).toISOString(), "older"),
      ],
      now,
    );

    expect(groups.map((group) => group.title)).toEqual([
      "Today",
      "Yesterday",
      new Date(2026, 8, 12).toLocaleDateString(undefined, {
        day: "numeric",
        month: "short",
      }),
    ]);
  });

  it("keeps same-day entries in one group, in the order given", () => {
    const groups = groupByDay(
      [
        at(new Date(2026, 8, 20, 9, 0).toISOString(), "a"),
        at(new Date(2026, 8, 20, 1, 0).toISOString(), "b"),
      ],
      now,
    );

    expect(groups).toHaveLength(1);
    expect(groups[0].items.map((item) => item.id)).toEqual(["a", "b"]);
  });

  /** 23:50 yesterday is not "Today" ten minutes later — calendar days, not hours. */
  it("cuts on the calendar day rather than elapsed hours", () => {
    const justBeforeMidnight = new Date(2026, 8, 19, 23, 50);
    const groups = groupByDay(
      [at(justBeforeMidnight.toISOString())],
      new Date(2026, 8, 20, 0, 10),
    );

    expect(groups[0].title).toBe("Yesterday");
  });
});

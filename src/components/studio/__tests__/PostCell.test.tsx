import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

import { PostCell } from "@/components/studio/PostCell";
import type { VideoResponse } from "@/lib/api/types";

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

const video = (pinnedAt: string | null): VideoResponse =>
  ({
    id: "1001",
    userId: "1",
    title: "A post",
    description: null,
    thumbnailUrl: null,
    status: "PUBLISHED",
    visibility: "PUBLIC",
    createdAt: "2026-11-01T00:00:00Z",
    pinnedAt,
  }) as VideoResponse;

afterEach(cleanup);

describe("PostCell pinned label", () => {
  it("marks a pinned post the way TikTok Studio does, ahead of the date", () => {
    render(<PostCell video={video("2026-11-05T00:00:00Z")} />);

    const label = screen.getByText("Pinned");
    // The label opens the meta line, the date right after it.
    expect(label.nextSibling?.textContent).toBe("Nov 1, 2026");
    expect(label.querySelector("svg")).not.toBeNull();
  });

  it("says nothing for a post that is not pinned", () => {
    render(<PostCell video={video(null)} />);

    expect(screen.queryByText("Pinned")).toBeNull();
  });
});

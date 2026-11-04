import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, waitFor } from "@testing-library/react";

import StudioCommentsRoute from "@/app/studio/comment/page";

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));
vi.mock("@/components/ui/toast", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
vi.mock("@/hooks/use-comment-context", () => ({
  useCommentContext: () => ({ authors: new Map(), videos: new Map() }),
}));
vi.mock("@/lib/api/interactions", () => ({ addComment: vi.fn(), approveComment: vi.fn(), deleteComment: vi.fn() }));

const listInboxComments = vi.fn();
vi.mock("@/lib/api/studio", () => ({
  listInboxComments: (...args: unknown[]) => listInboxComments(...args),
  listStudioPosts: () => Promise.resolve({ content: [], page: { size: 50, number: 0, totalElements: 0, totalPages: 0 } }),
}));

const videoIdOfCall = (index: number) => (listInboxComments.mock.calls[index]?.[0] as { videoId?: string }).videoId;

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("/studio/comment route", () => {
  it("remounts the inbox when the URL moves to another post, so the filter follows it", async () => {
    listInboxComments.mockResolvedValue({ items: [], nextCursor: null, hasMore: false });

    const first = await StudioCommentsRoute({ searchParams: Promise.resolve({ videoId: "1001" }) });
    const { rerender } = render(first);
    await waitFor(() => expect(videoIdOfCall(0)).toBe("1001"));

    rerender(await StudioCommentsRoute({ searchParams: Promise.resolve({ videoId: "1002" }) }));

    await waitFor(() => expect(videoIdOfCall(listInboxComments.mock.calls.length - 1)).toBe("1002"));
  });

  it("drops a videoId that cannot be a backend id before it reaches the inbox", async () => {
    const element = await StudioCommentsRoute({ searchParams: Promise.resolve({ videoId: "x7" }) });
    expect(element.props.initialVideoId).toBeUndefined();
  });

  it("passes a real video id through", async () => {
    const element = await StudioCommentsRoute({ searchParams: Promise.resolve({ videoId: "7312458901234567" }) });
    expect(element.props.initialVideoId).toBe("7312458901234567");
  });
});

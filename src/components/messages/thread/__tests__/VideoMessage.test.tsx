import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { VideoCard } from "@/lib/api/conversations";

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import { VideoMessage } from "@/components/messages/thread/VideoMessage";

const card = (over: Partial<VideoCard> = {}): VideoCard => ({
  videoId: "77",
  state: "AVAILABLE",
  ownerId: "5",
  thumbnailUrl: "https://cdn.example/t.jpg",
  title: "Cake",
  durationSeconds: 12,
  ...over,
});

afterEach(cleanup);

describe("VideoMessage", () => {
  it("is a link to the video's own page and does not play anything", () => {
    const { container } = render(<VideoMessage video={card()} mine={false} />);
    const link = screen.getByRole("link", { name: /Cake/ });
    expect(link.getAttribute("href")).toBe("/video/77");
    expect(container.querySelector("video")).toBeNull();
    expect(container.querySelector("img")?.getAttribute("src")).toBe("https://cdn.example/t.jpg");
  });

  it("keeps the portrait card for an available video and a compact fixed notice when it cannot be shown", () => {
    const classes = [card(), card({ state: "UNAVAILABLE", thumbnailUrl: null, title: null }), card({ state: "UNKNOWN" })].map(
      (video) => {
        const { container, unmount } = render(<VideoMessage video={video} mine />);
        const className = (container.firstElementChild as HTMLElement).className;
        unmount();
        return className;
      },
    );
    expect(/h-\[320px\] w-\[180px\]/.test(classes[0])).toBe(true);
    expect(classes[1]).toBe(classes[2]);
    expect(/h-\[84px\] w-\[236px\]/.test(classes[1])).toBe(true);
  });

  it("shows a placeholder, and no thumbnail or title, for a video that is gone", () => {
    const { container } = render(
      <VideoMessage video={card({ state: "UNAVAILABLE", thumbnailUrl: null, title: null })} mine={false} />,
    );
    expect(screen.getByRole("img", { name: "Video unavailable" })).toBeTruthy();
    expect(screen.queryByRole("link")).toBeNull();
    expect(container.querySelector("img")).toBeNull();
  });

  it("says it could not load, not that it was deleted, when the video service did not answer", () => {
    render(<VideoMessage video={card({ state: "UNKNOWN", thumbnailUrl: null, title: null })} mine={false} />);
    expect(screen.getByRole("img", { name: /couldn't be loaded/i })).toBeTruthy();
    expect(screen.queryByText(/isn't available/i)).toBeNull();
  });

  it("keeps the card when its thumbnail fails to load", () => {
    const { container } = render(<VideoMessage video={card()} mine={false} />);
    fireEvent.error(container.querySelector("img") as HTMLImageElement);
    expect(container.querySelector("img")).toBeNull();
    expect(screen.getByRole("link", { name: /Cake/ })).toBeTruthy();
  });

  it("treats a missing card as unavailable", () => {
    render(<VideoMessage video={null} mine={false} />);
    expect(screen.getByRole("img", { name: "Video unavailable" })).toBeTruthy();
  });
});

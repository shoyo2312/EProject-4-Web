import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

import { StudioShell } from "@/components/studio/StudioShell";

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));
vi.mock("next/image", () => ({
  // eslint-disable-next-line @next/next/no-img-element
  default: ({ src, alt }: { src: string; alt: string }) => <img src={src} alt={alt} />,
}));
vi.mock("next/navigation", () => ({ usePathname: () => "/studio" }));

const session = { user: { userId: "1", username: "me", displayName: "Me", avatarUrl: null as string | null } };
vi.mock("@/components/session/SessionProvider", () => ({
  useSession: () => ({ ...session, isLoading: false, openLogin: vi.fn(), confirmSignOut: vi.fn() }),
}));

afterEach(() => {
  cleanup();
  session.user.avatarUrl = null;
});

describe("StudioShell account menu", () => {
  it("shows a placeholder, not an empty image, for an account without an avatar", () => {
    render(
      <StudioShell>
        <p>inside</p>
      </StudioShell>,
    );

    const trigger = screen.getByRole("button", { name: "Account menu" });
    expect(trigger.querySelector("img")).toBeNull();
    expect(trigger.querySelector("svg")).toBeTruthy();
  });

  it("shows the avatar when there is one", () => {
    session.user.avatarUrl = "https://cdn.example/me.jpg";
    render(
      <StudioShell>
        <p>inside</p>
      </StudioShell>,
    );

    const trigger = screen.getByRole("button", { name: "Account menu" });
    expect(trigger.querySelector("img")?.getAttribute("src")).toBe("https://cdn.example/me.jpg");
  });
});

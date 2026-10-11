import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

import { FollowRequestsModal } from "@/components/layout/FollowRequestsModal";

const getFollowRequests = vi.fn();
const approveFollowRequest = vi.fn();
const declineFollowRequest = vi.fn();
vi.mock("@/lib/api/users", () => ({
  getFollowRequests: (...args: unknown[]) => getFollowRequests(...args),
  approveFollowRequest: (id: string) => approveFollowRequest(id),
  declineFollowRequest: (id: string) => declineFollowRequest(id),
}));
vi.mock("@/components/ui/toast", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

const person = (userId: string, displayName: string) => ({
  userId,
  username: null,
  displayName,
  bio: null,
  avatarUrl: null,
  followerCount: 0,
  followingCount: 0,
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("FollowRequestsModal", () => {
  it("confirms a request, and puts back one whose delete failed", async () => {
    getFollowRequests.mockResolvedValue({
      content: [person("1", "Ann"), person("2", "Bo")],
      page: { number: 0, size: 50, totalElements: 2, totalPages: 1 },
    });
    approveFollowRequest.mockResolvedValue({ status: "FOLLOWING" });
    declineFollowRequest.mockRejectedValue(new Error("down"));
    const onSettled = vi.fn();

    render(<FollowRequestsModal onClose={() => {}} onLeave={() => {}} onSettled={onSettled} />);
    await screen.findByText("Ann");

    fireEvent.click(screen.getAllByRole("button", { name: "Confirm" })[0]);
    expect(screen.queryByText("Ann")).toBeNull();
    expect(approveFollowRequest).toHaveBeenCalledWith("1");
    await waitFor(() => expect(onSettled).toHaveBeenCalledOnce());

    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    expect(screen.queryByText("Bo")).toBeNull();
    expect(await screen.findByText("Bo")).not.toBeNull();
    expect(onSettled).toHaveBeenCalledOnce();
  });
});

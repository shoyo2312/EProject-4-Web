import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { MessageResponse } from "@/lib/api/conversations";
import { ApiError } from "@/lib/api/errors";

const { listMessages, submit } = vi.hoisted(() => ({ listMessages: vi.fn(), submit: vi.fn() }));

vi.mock("@/components/session/SessionProvider", () => ({ useSession: () => ({ user: { userId: "1" } }) }));
vi.mock("@/lib/api/conversations", () => ({ listMessages: (...args: unknown[]) => listMessages(...args) }));
vi.mock("@/lib/api/reports", () => ({ submitDirectMessageReport: (...args: unknown[]) => submit(...args) }));

import { ReportFlow } from "@/components/messages/report/ReportFlow";

const message = (id: string, sender = "2", over: Partial<MessageResponse> = {}): MessageResponse => ({
  id,
  conversationId: "c1",
  senderId: sender,
  type: "TEXT",
  content: `text ${id}`,
  stickerId: null,
  sticker: null,
  sentAt: `2026-10-29T10:${String(Number(id) % 60).padStart(2, "0")}:00.000Z`,
  replyToMessageId: null,
  replyTo: null,
  recalledAt: null,
  reactions: [],
  revision: 0,
  ...over,
});

const page = (ids: string[], hasMore = false) => ({
  items: ids.map((id) => message(id)).reverse(),
  nextCursor: hasMore ? "next" : null,
  hasMore,
});

const reasonStep = () => {
  render(<ReportFlow conversationId="c1" name="Sam" onClose={vi.fn()} />);
};

const toSelect = async (ids: string[] = ["1", "2", "3"]) => {
  listMessages.mockResolvedValue(page(ids));
  fireEvent.click(screen.getByRole("radio", { name: "Hate and harassment" }));
  fireEvent.click(screen.getByRole("button", { name: "Next" }));
  await screen.findAllByRole("checkbox");
};

beforeEach(() => {
  listMessages.mockReset();
  submit.mockReset();
});
afterEach(cleanup);

describe("ReportFlow", () => {
  it("keeps Next off until one reason is chosen, and calls nothing before Submit", async () => {
    reasonStep();
    const next = screen.getByRole("button", { name: "Next" });
    expect((next as HTMLButtonElement).disabled).toBe(true);

    fireEvent.click(screen.getByRole("radio", { name: "Hate and harassment" }));
    fireEvent.click(screen.getByRole("radio", { name: "Frauds and scams" }));
    expect(screen.getAllByRole("radio").filter((r) => r.getAttribute("aria-checked") === "true")).toHaveLength(1);
    expect((next as HTMLButtonElement).disabled).toBe(false);
    expect(submit).not.toHaveBeenCalled();

    await toSelect();
    expect(screen.getByText("Report reason: Hate and harassment")).toBeTruthy();
    expect(submit).not.toHaveBeenCalled();
  });

  it("counts picks, unticks, and sends only ids; success shows after the server answers", async () => {
    reasonStep();
    await toSelect();
    expect(screen.getByText("0/50 messages selected")).toBeTruthy();
    const submitButton = screen.getByRole("button", { name: "Submit" });
    expect((submitButton as HTMLButtonElement).disabled).toBe(true);

    const boxes = screen.getAllByRole("checkbox");
    fireEvent.click(boxes[0]);
    fireEvent.click(boxes[1]);
    fireEvent.click(boxes[1]);
    expect(screen.getByText("1/50 message selected")).toBeTruthy();

    let resolve: () => void = () => {};
    submit.mockReturnValue(new Promise<void>((done) => (resolve = done)));
    fireEvent.click(submitButton);
    fireEvent.click(screen.getByRole("button", { name: /Submitting/ }));
    expect(submit).toHaveBeenCalledTimes(1);
    expect(submit.mock.calls[0].slice(0, 3)).toEqual(["c1", "Hate and harassment", ["1"]]);
    expect(screen.queryByText("Thanks for reporting")).toBeNull();

    await act(async () => resolve());
    expect(await screen.findByText("Thanks for reporting")).toBeTruthy();
  });

  it("refuses the 51st message and keeps the first 50", { timeout: 60000 }, async () => {
    reasonStep();
    await toSelect(Array.from({ length: 51 }, (_, i) => String(i + 1)));
    const boxes = screen.getAllByRole("checkbox");
    boxes.forEach((box) => fireEvent.click(box));
    expect(screen.getByText("50/50 messages selected")).toBeTruthy();
    expect(screen.getByRole("alert").textContent).toMatch(/up to 50/);
    expect(boxes[50].getAttribute("aria-checked")).toBe("false");
    expect(boxes[0].getAttribute("aria-checked")).toBe("true");
  });

  it("picks with Space and does not pick a recalled message", async () => {
    reasonStep();
    listMessages.mockResolvedValue({
      items: [message("2", "2", { recalledAt: "2026-10-29T10:05:00.000Z", content: null }), message("1")],
      nextCursor: null,
      hasMore: false,
    });
    fireEvent.click(screen.getByRole("radio", { name: "Other" }));
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    const boxes = await screen.findAllByRole("checkbox");
    fireEvent.keyDown(boxes[0], { key: " " });
    fireEvent.click(boxes[1]);
    expect(boxes[0].getAttribute("aria-checked")).toBe("true");
    expect(boxes[1].getAttribute("aria-checked")).toBe("false");
  });

  it("keeps reason and selection when the submit fails, then retries with the same request id", async () => {
    reasonStep();
    await toSelect();
    fireEvent.click(screen.getAllByRole("checkbox")[0]);
    submit.mockRejectedValueOnce(new ApiError(503, "CHAT_EVIDENCE_UNAVAILABLE", "down"));
    fireEvent.click(screen.getByRole("button", { name: "Submit" }));
    await waitFor(() => expect(screen.getByRole("alert").textContent).toMatch(/couldn't read/i));
    expect(screen.getByText("1/50 message selected")).toBeTruthy();
    expect(screen.queryByText("Thanks for reporting")).toBeNull();

    submit.mockResolvedValueOnce(undefined);
    fireEvent.click(screen.getByRole("button", { name: "Submit" }));
    await screen.findByText("Thanks for reporting");
    expect(submit.mock.calls[1][3]).toBe(submit.mock.calls[0][3]);
  });

  it("Back returns to the reasons and keeps what was picked", async () => {
    reasonStep();
    await toSelect();
    fireEvent.click(screen.getAllByRole("checkbox")[0]);
    fireEvent.click(screen.getByRole("button", { name: "Back" }));
    expect(screen.getByRole("radio", { name: "Hate and harassment" }).getAttribute("aria-checked")).toBe("true");
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    await screen.findAllByRole("checkbox");
    expect(screen.getByText("1/50 message selected")).toBeTruthy();
  });
});

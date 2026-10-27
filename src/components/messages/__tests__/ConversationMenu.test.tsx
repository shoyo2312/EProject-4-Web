import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { ConversationResponse } from "@/lib/api/conversations";
import { ApiError } from "@/lib/api/errors";

const { chat, block, replace, toast } = vi.hoisted(() => ({
  chat: {
    nowMs: Date.parse("2026-10-27T09:00:00Z"),
    pin: vi.fn(),
    unpin: vi.fn(),
    mute: vi.fn(),
    unmute: vi.fn(),
    deleteConversation: vi.fn(),
    markBlocked: vi.fn(),
  },
  block: vi.fn(),
  replace: vi.fn(),
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock("@/components/messages/ChatUnreadProvider", () => ({ useChatUnreadContext: () => chat }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace, push: vi.fn() }) }));
vi.mock("@/lib/api/users", () => ({ block: (...args: unknown[]) => block(...args) }));
vi.mock("@/components/ui/toast", () => ({ toast }));
vi.mock("@/components/session/SessionProvider", () => ({ useSession: () => ({ user: { userId: "1" } }) }));
vi.mock("@/hooks/use-hover-capable", () => ({ useHoverCapable: () => true }));

import { ConversationRow } from "@/components/messages/ConversationList";

const convo = (over: Partial<ConversationResponse> = {}): ConversationResponse => ({
  id: "c1",
  participantIds: ["1", "2"],
  lastMessageContent: "hi",
  lastMessageType: "TEXT",
  lastMessageSenderId: "2",
  lastMessageAt: "2026-10-27T08:00:00.000Z",
  createdAt: null,
  hasUnread: true,
  requestState: null,
  initiatorId: null,
  sendPermission: "ALLOWED",
  retryAvailableAt: null,
  lastMessageRecalled: false,
  pinnedAt: null,
  muteMode: "NONE",
  mutedUntil: null,
  inboxHidden: false,
  ...over,
});

const author = { nickname: "Alice", avatarUrl: "", handle: "alice" } as never;

function mount(item = convo(), active = false) {
  return render(<ConversationRow item={item} author={author} me="1" active={active} withMenu />);
}

const openMenu = () => fireEvent.click(screen.getByRole("button", { name: "More options for Alice" }));
const choose = (name: RegExp | string) => fireEvent.click(screen.getByRole("menuitem", { name }));

beforeEach(() => {
  for (const fn of [chat.pin, chat.unpin, chat.mute, chat.unmute, chat.deleteConversation, chat.markBlocked, block, replace, toast.success, toast.error]) {
    fn.mockReset();
  }
  chat.pin.mockResolvedValue(convo());
  chat.unpin.mockResolvedValue(convo());
  chat.mute.mockResolvedValue(convo());
  chat.unmute.mockResolvedValue(convo());
  chat.deleteConversation.mockResolvedValue(undefined);
  block.mockResolvedValue(undefined);
});
afterEach(cleanup);

describe("conversation menu", () => {
  it("is a button beside the row's link, not inside it, and opening it does not navigate", () => {
    mount();
    const link = screen.getByRole("link");
    const button = screen.getByRole("button", { name: "More options for Alice" });
    expect(link.contains(button)).toBe(false);
    openMenu();
    expect(screen.getByRole("menu")).toBeTruthy();
  });

  it("offers mute, pin, block and delete — and no report", () => {
    mount();
    openMenu();
    const labels = screen.getAllByRole("menuitem").map((item) => item.textContent);
    expect(labels).toEqual(["Mute notifications", "Pin to top", "Block", "Delete"]);
    expect(screen.queryByText(/report/i)).toBeNull();
  });

  it("is not on a row that did not ask for it (the request box)", () => {
    render(<ConversationRow item={convo()} author={author} me="1" active={false} />);
    expect(screen.queryByRole("button", { name: /More options/ })).toBeNull();
  });

  it("closes on Escape and on a press outside", () => {
    mount();
    openMenu();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("menu")).toBeNull();

    openMenu();
    fireEvent.pointerDown(document.body);
    expect(screen.queryByRole("menu")).toBeNull();
  });

  it("draws the menu in the document body, outside the clipping list", () => {
    const { container } = mount();
    openMenu();
    expect(container.contains(screen.getByRole("menu"))).toBe(false);
  });

  it("moves between items with the arrow keys", () => {
    mount();
    openMenu();
    const items = screen.getAllByRole("menuitem");
    items[0].focus();
    fireEvent.keyDown(screen.getByRole("menu"), { key: "ArrowDown" });
    expect(document.activeElement).toBe(items[1]);
    fireEvent.keyDown(screen.getByRole("menu"), { key: "ArrowUp" });
    expect(document.activeElement).toBe(items[0]);
  });
});

describe("pin", () => {
  it("pins and unpins", async () => {
    mount();
    openMenu();
    await act(async () => choose("Pin to top"));
    expect(chat.pin).toHaveBeenCalledWith("c1");

    cleanup();
    mount(convo({ pinnedAt: "2026-10-27T08:30:00.000Z" }));
    openMenu();
    await act(async () => choose("Unpin"));
    expect(chat.unpin).toHaveBeenCalledWith("c1");
  });

  it("shows the server's refusal at three and changes nothing else", async () => {
    chat.pin.mockRejectedValue(new ApiError(409, "PIN_LIMIT_REACHED", "x"));
    mount();
    openMenu();
    await act(async () => choose("Pin to top"));
    expect(toast.error).toHaveBeenCalledWith("You can pin at most 3 conversations. Unpin one first.");
    expect(chat.unpin).not.toHaveBeenCalled();
  });
});

describe("mute", () => {
  it("asks for one of four lengths; Cancel changes nothing", async () => {
    mount();
    openMenu();
    choose("Mute notifications");
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getAllByRole("radio").map((r) => r.textContent)).toEqual([
      "1 hour",
      "8 hours",
      "24 hours",
      "Until I change it",
    ]);
    expect(dialog.textContent).toMatch(/still receive/i);

    await act(async () => fireEvent.click(within(dialog).getByRole("button", { name: "Cancel" })));
    expect(chat.mute).not.toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it.each([
    ["1 hour", "ONE_HOUR"],
    ["8 hours", "EIGHT_HOURS"],
    ["24 hours", "TWENTY_FOUR_HOURS"],
    ["Until I change it", "INDEFINITE"],
  ])("sends %s as %s only after Mute is pressed", async (label, length) => {
    mount();
    openMenu();
    choose("Mute notifications");
    fireEvent.click(screen.getByRole("radio", { name: label }));
    expect(chat.mute).not.toHaveBeenCalled();
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Mute" })));
    expect(chat.mute).toHaveBeenCalledWith("c1", length);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("offers Unmute and a change of length while muted, and unmutes at once", async () => {
    mount(convo({ muteMode: "INDEFINITE" }));
    expect(screen.getByLabelText("Notifications muted")).toBeTruthy();
    openMenu();
    expect(screen.getAllByRole("menuitem").map((i) => i.textContent)).toEqual([
      "Unmute notifications",
      "Change mute duration",
      "Pin to top",
      "Block",
      "Delete",
    ]);
    await act(async () => choose("Unmute notifications"));
    expect(chat.unmute).toHaveBeenCalledWith("c1");
  });

  it("treats a timed mute that has ended as no mute", () => {
    mount(convo({ muteMode: "TIMED", mutedUntil: "2026-10-27T08:59:59.000Z" }));
    expect(screen.queryByLabelText("Notifications muted")).toBeNull();
    openMenu();
    expect(screen.getByRole("menuitem", { name: "Mute notifications" })).toBeTruthy();
  });

  it("keeps the dialog open with the reason when the server refuses", async () => {
    chat.mute.mockRejectedValue(new ApiError(500, "X", "x"));
    mount();
    openMenu();
    choose("Mute notifications");
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Mute" })));
    expect(screen.getByRole("alert").textContent).toMatch(/something went wrong/i);
    expect(screen.getByRole("dialog")).toBeTruthy();
  });
});

describe("block", () => {
  it("asks first, naming the person, and calls nothing until Block is pressed", async () => {
    mount();
    openMenu();
    choose("Block");
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByRole("heading").textContent).toBe("Block Alice?");
    expect(dialog.textContent).toMatch(/won.t be able to send each other messages/i);
    expect(block).not.toHaveBeenCalled();

    await act(async () => fireEvent.click(within(dialog).getByRole("button", { name: "Cancel" })));
    expect(block).not.toHaveBeenCalled();
    expect(chat.markBlocked).not.toHaveBeenCalled();
  });

  it("blocks the other person's account and closes the composer of that conversation", async () => {
    mount();
    openMenu();
    choose("Block");
    await act(async () => fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Block" })));
    expect(block).toHaveBeenCalledWith("2");
    expect(chat.markBlocked).toHaveBeenCalledWith("c1");
    expect(toast.success).toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("shows a failure, claims no success, and can be retried", async () => {
    block.mockRejectedValueOnce(new ApiError(0, "NETWORK", "x"));
    mount();
    openMenu();
    choose("Block");
    const press = () => within(screen.getByRole("dialog")).getByRole("button", { name: "Block" });
    await act(async () => fireEvent.click(press()));
    expect(screen.getByRole("alert").textContent).toMatch(/can.t reach the server/i);
    expect(chat.markBlocked).not.toHaveBeenCalled();
    expect(toast.success).not.toHaveBeenCalled();

    await act(async () => fireEvent.click(press()));
    expect(block).toHaveBeenCalledTimes(2);
    expect(chat.markBlocked).toHaveBeenCalledWith("c1");
  });

  it("counts an account that was already blocked as done", async () => {
    block.mockRejectedValue(new ApiError(409, "ALREADY_BLOCKED", "x"));
    mount();
    openMenu();
    choose("Block");
    await act(async () => fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Block" })));
    expect(chat.markBlocked).toHaveBeenCalledWith("c1");
  });

  it("is not pressed twice while the request is out", async () => {
    let release: () => void = () => {};
    block.mockReturnValue(new Promise<void>((resolve) => (release = resolve)));
    mount();
    openMenu();
    choose("Block");
    const press = () => within(screen.getByRole("dialog")).getByRole("button", { name: /Block/ });
    fireEvent.click(press());
    fireEvent.click(press());
    expect(block).toHaveBeenCalledTimes(1);
    await act(async () => release());
  });
});

describe("delete", () => {
  it("asks first, says it is from your side only, and sends nothing on Cancel", async () => {
    mount();
    openMenu();
    choose("Delete");
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByRole("heading").textContent).toBe("Delete chat with Alice?");
    expect(dialog.textContent).toMatch(/from your side/i);
    expect(dialog.textContent).toMatch(/still have their copy/i);

    await act(async () => fireEvent.click(within(dialog).getByRole("button", { name: "Cancel" })));
    expect(chat.deleteConversation).not.toHaveBeenCalled();
  });

  it("deletes after confirming and leaves an open thread for the inbox", async () => {
    mount(convo(), true);
    openMenu();
    choose("Delete");
    await act(async () => fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Delete" })));
    expect(chat.deleteConversation).toHaveBeenCalledWith("c1");
    expect(replace).toHaveBeenCalledWith("/messages");
  });

  it("does not navigate away from another thread, or when it fails", async () => {
    chat.deleteConversation.mockRejectedValueOnce(new ApiError(500, "X", "x"));
    mount(convo(), true);
    openMenu();
    choose("Delete");
    await act(async () => fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Delete" })));
    expect(replace).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toBeTruthy();

    cleanup();
    mount(convo(), false);
    openMenu();
    choose("Delete");
    await act(async () => fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Delete" })));
    expect(replace).not.toHaveBeenCalled();
  });
});

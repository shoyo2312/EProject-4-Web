import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { StoryReplyBar } from "@/components/stories/StoryReplyBar";
import { ApiError } from "@/lib/api/errors";

const { sendStoryReply } = vi.hoisted(() => ({ sendStoryReply: vi.fn() }));
vi.mock("@/lib/api/conversations", () => ({ sendStoryReply }));

function setup(overrides: Partial<React.ComponentProps<typeof StoryReplyBar>> = {}) {
  const props = {
    storyId: "s1",
    initialDraft: "",
    onDraftChange: vi.fn(),
    onActiveChange: vi.fn(),
    signedIn: true,
    onRequireLogin: vi.fn(),
    onOpenChat: vi.fn(),
    ...overrides,
  };
  render(<StoryReplyBar {...props} />);
  return { props, input: screen.getByLabelText("Reply to this story") as HTMLInputElement };
}

beforeEach(() => {
  sendStoryReply.mockReset();
  let n = 0;
  vi.stubGlobal("crypto", { randomUUID: () => `id-${++n}` });
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("StoryReplyBar", () => {
  it("pauses the story while focused or holding text, and releases it when emptied and blurred", () => {
    const { props, input } = setup();
    fireEvent.focus(input);
    expect(props.onActiveChange).toHaveBeenLastCalledWith(true);
    fireEvent.change(input, { target: { value: "hi" } });
    fireEvent.change(input, { target: { value: "" } });
    fireEvent.blur(input);
    expect(props.onActiveChange).toHaveBeenLastCalledWith(false);
  });

  it("sends the trimmed text for this story, clears only this story's draft, and offers the chat", async () => {
    sendStoryReply.mockResolvedValue({ id: "m1", conversationId: "c9" });
    const { props, input } = setup();
    fireEvent.change(input, { target: { value: "  hello  " } });
    fireEvent.click(screen.getByRole("button", { name: "Send reply" }));
    await waitFor(() => expect(sendStoryReply).toHaveBeenCalledTimes(1));
    expect(sendStoryReply).toHaveBeenCalledWith({ storyId: "s1", content: "hello", clientRequestId: "id-1" });
    await screen.findByText("Sent");
    expect(props.onDraftChange).toHaveBeenLastCalledWith("s1", "");
    expect(input.value).toBe("");
    fireEvent.click(screen.getByRole("button", { name: "View chat" }));
    expect(props.onOpenChat).toHaveBeenCalledWith("c9");
  });

  it("keeps the draft on failure and retries the same request id for the same text", async () => {
    sendStoryReply.mockRejectedValueOnce(new Error("offline")).mockResolvedValueOnce({ id: "m1", conversationId: "c9" });
    const { input } = setup();
    fireEvent.change(input, { target: { value: "hello" } });
    fireEvent.submit(input.closest("form") as HTMLFormElement);
    await screen.findByText("Couldn't send. Try again");
    expect(input.value).toBe("hello");
    fireEvent.submit(input.closest("form") as HTMLFormElement);
    await waitFor(() => expect(sendStoryReply).toHaveBeenCalledTimes(2));
    expect(sendStoryReply.mock.calls[1][0].clientRequestId).toBe(sendStoryReply.mock.calls[0][0].clientRequestId);
  });

  it("uses a new request id once the text changed", async () => {
    sendStoryReply.mockRejectedValue(new Error("offline"));
    const { input } = setup();
    fireEvent.change(input, { target: { value: "one" } });
    fireEvent.submit(input.closest("form") as HTMLFormElement);
    await screen.findByText("Couldn't send. Try again");
    fireEvent.change(input, { target: { value: "two" } });
    fireEvent.submit(input.closest("form") as HTMLFormElement);
    await waitFor(() => expect(sendStoryReply).toHaveBeenCalledTimes(2));
    expect(sendStoryReply.mock.calls[1][0].clientRequestId).not.toBe(sendStoryReply.mock.calls[0][0].clientRequestId);
  });

  it("says so when the story is gone, and does not send blank text", async () => {
    sendStoryReply.mockRejectedValue(new ApiError(404, "STORY_NOT_AVAILABLE", "gone"));
    const { input } = setup();
    fireEvent.change(input, { target: { value: "   " } });
    expect(screen.getByRole("button", { name: "Send reply" }).hasAttribute("disabled")).toBe(true);
    fireEvent.submit(input.closest("form") as HTMLFormElement);
    expect(sendStoryReply).not.toHaveBeenCalled();
    fireEvent.change(input, { target: { value: "hi" } });
    fireEvent.submit(input.closest("form") as HTMLFormElement);
    await screen.findByText("This story isn't available anymore");
  });

  it("a quick emoji lands in the draft and sends nothing", () => {
    const { props, input } = setup();
    fireEvent.focus(input);
    fireEvent.click(screen.getByRole("button", { name: "Add 🔥" }));
    expect(input.value).toBe("🔥");
    expect(props.onDraftChange).toHaveBeenLastCalledWith("s1", "🔥");
    expect(sendStoryReply).not.toHaveBeenCalled();
  });

  it("Enter during IME composition is not a send; Escape in the field leaves it before the viewer closes", () => {
    const { input } = setup();
    fireEvent.change(input, { target: { value: "xin chào" } });
    const enter = new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true, isComposing: true });
    act(() => {
      input.dispatchEvent(enter);
    });
    expect(enter.defaultPrevented).toBe(true);
    const outer = vi.fn();
    document.addEventListener("keydown", outer);
    input.focus();
    fireEvent.focus(input);
    fireEvent.keyDown(input, { key: "Escape" });
    expect(outer).not.toHaveBeenCalled();
    document.removeEventListener("keydown", outer);
  });

  it("asks a guest to sign in instead of focusing the field", () => {
    const { props, input } = setup({ signedIn: false });
    fireEvent.focus(input);
    expect(props.onRequireLogin).toHaveBeenCalled();
    expect(sendStoryReply).not.toHaveBeenCalled();
  });

  it("a click or press on the bar never reaches the media beneath it", () => {
    const media = vi.fn();
    render(
      <div onPointerDown={media} onClick={media}>
        <StoryReplyBar
          storyId="s2" initialDraft="" onDraftChange={() => {}} onActiveChange={() => {}}
          signedIn onRequireLogin={() => {}} onOpenChat={() => {}}
        />
      </div>,
    );
    const inputs = screen.getAllByLabelText("Reply to this story");
    fireEvent.pointerDown(inputs[inputs.length - 1]);
    fireEvent.click(inputs[inputs.length - 1]);
    expect(media).not.toHaveBeenCalled();
  });
});

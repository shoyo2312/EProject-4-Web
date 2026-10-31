import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { KeywordFiltersPage } from "@/components/settings/rows/keyword-filters/KeywordFiltersPage";
import {
  createKeywordFilter,
  deleteKeywordFilter,
  listKeywordFilters,
  updateKeywordFilter,
  type KeywordFilter,
} from "@/lib/api/keyword-filters";

vi.mock("@/lib/api/keyword-filters", () => ({
  listKeywordFilters: vi.fn(),
  createKeywordFilter: vi.fn(),
  updateKeywordFilter: vi.fn(),
  deleteKeywordFilter: vi.fn(),
}));
vi.mock("@/components/ui/toast", () => ({ toast: { error: vi.fn() } }));
vi.mock("@/components/session/SessionProvider", () => ({
  useSession: () => ({ user: { userId: "1" } }),
}));

const cat: KeywordFilter = { id: "11", keyword: "cat", forYou: true, following: false, friends: true };

beforeEach(() => {
  vi.mocked(listKeywordFilters).mockResolvedValue([cat]);
});

afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});

async function openForm() {
  render(<KeywordFiltersPage onLeave={() => {}} />);
  await screen.findByText("cat");
  fireEvent.click(screen.getByRole("button", { name: "Add keyword" }));
}

function type(text: string) {
  fireEvent.change(screen.getByRole("textbox", { name: "Keyword" }), { target: { value: text } });
}

const save = () => screen.getByRole("button", { name: "Save" });

it("lists the keywords with the feeds each is filtered from", async () => {
  render(<KeywordFiltersPage onLeave={() => {}} />);

  expect(await screen.findByText("cat")).toBeTruthy();
  expect(screen.getByText("For You, Friends")).toBeTruthy();
});

it("keeps Save disabled until a keyword and a feed are chosen", async () => {
  await openForm();

  expect(screen.getByRole("heading", { name: "Add keyword" })).toBeTruthy();
  expect(save().hasAttribute("disabled")).toBe(true);
  expect(screen.queryByText("Filter from")).toBeNull();

  type("dog");
  expect(screen.getByText("Filter from")).toBeTruthy();
  expect(screen.getByText("3/200")).toBeTruthy();
  expect(save().hasAttribute("disabled")).toBe(true);

  fireEvent.click(screen.getByRole("checkbox", { name: "For You" }));
  expect(save().hasAttribute("disabled")).toBe(false);

  type("dog video");
  expect(screen.getByText("Enter a single word or hashtag")).toBeTruthy();
  expect(save().hasAttribute("disabled")).toBe(true);
});

it("refuses a keyword already on the list, in any capitalization", async () => {
  await openForm();

  type("CAT");
  fireEvent.click(screen.getByRole("checkbox", { name: "Following" }));

  expect(screen.getByText("You've already added this keyword")).toBeTruthy();
  expect(save().hasAttribute("disabled")).toBe(true);
});

it("Select all ticks all three feeds", async () => {
  await openForm();
  type("dog");

  fireEvent.click(screen.getByRole("button", { name: "Select all" }));

  for (const feed of ["For You", "Following", "Friends"]) {
    expect((screen.getByRole("checkbox", { name: feed }) as HTMLInputElement).checked).toBe(true);
  }
});

it("saves the keyword with its feeds, and lists it", async () => {
  vi.mocked(createKeywordFilter).mockResolvedValue({
    id: "12",
    keyword: "dog",
    forYou: true,
    following: false,
    friends: true,
  });
  await openForm();

  type(" dog ");
  fireEvent.click(screen.getByRole("checkbox", { name: "For You" }));
  fireEvent.click(screen.getByRole("checkbox", { name: "Friends" }));
  fireEvent.click(save());

  await waitFor(() =>
    expect(createKeywordFilter).toHaveBeenCalledWith({
      keyword: "dog",
      forYou: true,
      following: false,
      friends: true,
    }),
  );
  expect(await screen.findByText("dog")).toBeTruthy();
  expect(screen.getByRole("button", { name: "Add keyword" })).toBeTruthy();
});

it("clears the field with its × button", async () => {
  await openForm();
  type("dog");

  fireEvent.click(screen.getByRole("button", { name: "Clear" }));

  expect((screen.getByRole("textbox", { name: "Keyword" }) as HTMLInputElement).value).toBe("");
});

it("edits a keyword in place", async () => {
  vi.mocked(updateKeywordFilter).mockResolvedValue({ ...cat, following: true });
  render(<KeywordFiltersPage onLeave={() => {}} />);
  await screen.findByText("cat");

  fireEvent.click(screen.getByRole("button", { name: "Edit cat" }));
  expect(screen.getByRole("heading", { name: "Edit keyword" })).toBeTruthy();
  expect((screen.getByRole("textbox", { name: "Keyword" }) as HTMLInputElement).value).toBe("cat");
  fireEvent.click(screen.getByRole("checkbox", { name: "Following" }));
  fireEvent.click(save());

  await waitFor(() =>
    expect(updateKeywordFilter).toHaveBeenCalledWith("11", {
      keyword: "cat",
      forYou: true,
      following: true,
      friends: true,
    }),
  );
  expect(await screen.findByText("For You, Following, Friends")).toBeTruthy();
});

it("deletes a keyword", async () => {
  vi.mocked(deleteKeywordFilter).mockResolvedValue();
  render(<KeywordFiltersPage onLeave={() => {}} />);
  await screen.findByText("cat");

  fireEvent.click(screen.getByRole("button", { name: "Delete cat" }));

  await waitFor(() => expect(screen.queryByText("cat")).toBeNull());
  expect(deleteKeywordFilter).toHaveBeenCalledWith("11");
});

import { act, renderHook, waitFor } from "@testing-library/react";
import { expect, it } from "vitest";

import { useStudioQuery } from "@/hooks/use-studio-query";

const answers: Record<string, () => Promise<string>> = {
  a: async () => "video a",
  b: async () => {
    throw new Error("gone");
  },
};

it("drops the last key's answer when the next key fails, so it is not shown as the new one", async () => {
  const { result, rerender } = renderHook(({ id }) => useStudioQuery(id, answers[id]), {
    initialProps: { id: "a" },
  });
  await waitFor(() => expect(result.current.data).toBe("video a"));

  rerender({ id: "b" });

  await waitFor(() => expect(result.current.error).not.toBeNull());
  expect(result.current.data).toBeNull();
});

it("keeps the answer it has when a reload of the same key fails", async () => {
  let fail = false;
  const { result } = renderHook(() =>
    useStudioQuery("a", async () => {
      if (fail) throw new Error("down");
      return "video a";
    }),
  );
  await waitFor(() => expect(result.current.data).toBe("video a"));

  fail = true;
  act(() => result.current.reload());

  await waitFor(() => expect(result.current.error).not.toBeNull());
  expect(result.current.data).toBe("video a");
});

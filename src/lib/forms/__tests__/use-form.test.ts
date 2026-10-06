import { describe, expect, it, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";

const toastError = vi.hoisted(() => vi.fn());
vi.mock("@/components/ui/toast", () => ({ toast: { error: toastError } }));

import { useForm } from "../use-form";
import { loginSchema } from "../schemas";

function setup(toastFieldErrors: boolean) {
  const { result } = renderHook(() =>
    useForm({
      schema: loginSchema,
      initialValues: { identifier: "", password: "" },
      onSubmit: () => {},
      toastFieldErrors,
    }),
  );
  // Registers both fields in screen order, as rendering would.
  result.current.field("identifier");
  result.current.field("password");
  return result;
}

describe("useForm toastFieldErrors", () => {
  beforeEach(() => toastError.mockReset());

  it("toasts only the first bad field, and still marks every field", async () => {
    const result = setup(true);
    await act(() => result.current.handleSubmit());

    expect(toastError).toHaveBeenCalledTimes(1);
    expect(toastError).toHaveBeenCalledWith(result.current.errors.identifier);
    expect(Object.keys(result.current.errors)).toEqual(["identifier", "password"]);
  });

  it("toasts a server error set on a field", () => {
    const result = setup(true);
    act(() => result.current.setFieldError("password", "Wrong password"));

    expect(toastError).toHaveBeenCalledWith("Wrong password");
    expect(result.current.errors.password).toBe("Wrong password");
  });

  it("stays silent when off", async () => {
    const result = setup(false);
    await act(() => result.current.handleSubmit());
    act(() => result.current.setFieldError("password", "Wrong password"));

    expect(toastError).not.toHaveBeenCalled();
  });
});

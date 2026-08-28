"use client";

import { Toaster as SonnerToaster, toast } from "sonner";

/**
 * App-wide toast host. One instance, mounted in the root layout.
 *
 * - top-center, matching the request (sonner's default is bottom-right)
 * - `richColors` gives the distinct success / warning / error skins; the CSS in
 *   `globals.css` (`.tt-toaster`) retints them to the TikTok-dark palette and
 *   swaps in the app font + 8px radius so they read as part of the product.
 *
 * Call sites use the re-exported `toast`: `toast.success(...)`,
 * `toast.warning(...)`, `toast.error(...)`.
 */
export function Toaster() {
  return (
    <SonnerToaster
      position="top-center"
      theme="dark"
      richColors
      closeButton
      toastOptions={{ className: "tt-toast" }}
      className="tt-toaster"
    />
  );
}

export { toast };

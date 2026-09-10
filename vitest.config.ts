import { defineConfig } from "vitest/config";
import path from "node:path";

// Minimal config: hooks are plain .ts (no JSX), so esbuild's default TS
// transform is enough — no @vitejs/plugin-react needed, and that plugin
// currently conflicts with this repo's Babel toolchain on `npm install`.
export default defineConfig({
  test: {
    environment: "jsdom",
    include: ["src/**/__tests__/**/*.test.ts", "src/**/__tests__/**/*.test.tsx"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});

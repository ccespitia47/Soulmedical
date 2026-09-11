import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["src/test/setup.ts"],
    // Acotar Vitest al frontend: los specs de backend/ son de Jest (NestJS)
    // y no deben correr aquí, ni los de node_modules/dist.
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
    exclude: ["node_modules/**", "backend/**", "dist/**", "dev-dist/**"],
  },
});

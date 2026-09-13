import { defineConfig } from "vitest/config";
export default defineConfig({
  root: process.cwd(),
  test: { environment: "node" },
  resolve: { alias: { "@": process.cwd() } }
});

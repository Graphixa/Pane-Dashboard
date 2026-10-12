import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
export default defineConfig({
  test: { setupFiles: ["./src/testSetup.ts"] },
  plugins: [react()],
  build: { rollupOptions: { input: { dashboard: "index.html", design: "design-system.html" } } },
  server: {
    proxy: {
      "/api": "http://127.0.0.1:8080",
      "/media": "http://127.0.0.1:8080",
    },
  },
});


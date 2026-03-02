import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";

export default defineConfig({
  plugins: [vue()],
  server: {
    proxy: {
      // DWDS-Anfragen über den Dev-Server, um CORS zu umgehen (nur Entwicklung).
      "/api/dwds": {
        target: "https://www.dwds.de",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/dwds/, "")
      }
    }
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./vitest.setup.js"]
  }
});

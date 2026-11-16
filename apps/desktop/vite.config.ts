import vue from "@vitejs/plugin-vue";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [vue()],
  clearScreen: false,
  server: { port: 1420, strictPort: true },
  // WebView2 (Windows) and WKWebView (macOS 12+) — ADR-027
  build: { target: ["es2022", "safari15", "chrome105"] },
});

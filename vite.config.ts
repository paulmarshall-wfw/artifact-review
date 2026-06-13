import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const apiBase = process.env.VITE_ARTIFACT_REVIEW_API_BASE ?? "http://127.0.0.1:4794";

export default defineConfig({
  plugins: [react()],
  server: {
    host: "127.0.0.1",
    port: 5184,
    strictPort: true,
    proxy: {
      "/api": apiBase,
      "/health": apiBase,
      "/ready": apiBase
    }
  },
  preview: {
    host: "127.0.0.1",
    port: 5184,
    strictPort: true
  }
});

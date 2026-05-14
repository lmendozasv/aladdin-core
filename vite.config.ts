import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: true,
    proxy: {
      "/public": { target: "http://localhost:8080", changeOrigin: true },
      "/auth": { target: "http://localhost:8080", changeOrigin: true },
      "/api": { target: "http://localhost:8080", changeOrigin: true },
      "/pricing": { target: "http://localhost:8080", changeOrigin: true }
    }
  },
});

import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const backend = "http://localhost:8000";

export default defineConfig({
  plugins: [react()],
  build: { outDir: "../pincel_ia/static", emptyOutDir: true },
  server: { proxy: { "/api": backend, "/i": backend } },
});

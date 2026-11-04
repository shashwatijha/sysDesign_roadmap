import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// base "./" + HashRouter lets the same build run locally and on GitHub Pages
export default defineConfig({
  base: "./",
  plugins: [react(), tailwindcss()],
  build: { chunkSizeWarningLimit: 3000 },
});

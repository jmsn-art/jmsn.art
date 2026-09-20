import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
export default defineConfig(({ mode }) => ({
  base: "/studio/",
  plugins: [react()],
  build: { outDir: mode === "site" ? "../studio" : "dist", emptyOutDir: true },
}));

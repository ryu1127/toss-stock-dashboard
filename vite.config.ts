import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// GitHub Pages serves this project from /toss-stock-dashboard/.
// Use that base path only for production builds so local `npm run dev`
// keeps working at the root path.
export default defineConfig(({ command }) => ({
  base: command === "build" ? "/toss-stock-dashboard/" : "/",
  plugins: [react()],
  server: {
    port: 5174,
    open: true,
  },
}));

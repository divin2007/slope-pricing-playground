import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  optimizeDeps: {
    include: ["react", "react-dom/client"],
  },
  server: {
    proxy: {
      "/elevation-api": {
        target: "https://api.open-elevation.com",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/elevation-api/, ""),
      },
      "/places-api": {
        target: "https://photon.komoot.io",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/places-api/, ""),
      },
      "/nominatim-api": {
        target: "https://nominatim.openstreetmap.org",
        changeOrigin: true,
        headers: {
          "User-Agent": "KigaliSlopePricingPlayground/1.0",
        },
        rewrite: (path) => path.replace(/^\/nominatim-api/, ""),
      },
    },
    warmup: {
      clientFiles: ["./src/main.jsx"],
    },
  },
  plugins: [react()],
});

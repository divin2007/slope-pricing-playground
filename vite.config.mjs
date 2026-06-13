import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  optimizeDeps: {
    include: ["react", "react-dom/client"],
  },
  server: {
    proxy: {
      "/api/elevation": {
        target: "https://api.open-elevation.com",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/elevation/, "/api/v1/lookup"),
      },
      "/api/places": {
        target: "https://photon.komoot.io",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/places/, "/api/"),
      },
      "/api/reverse": {
        target: "https://nominatim.openstreetmap.org",
        changeOrigin: true,
        headers: {
          "User-Agent": "KigaliSlopePricingPlayground/1.0",
        },
        rewrite: (path) => path.replace(/^\/api\/reverse/, "/reverse"),
      },
    },
    warmup: {
      clientFiles: ["./src/main.jsx"],
    },
  },
  plugins: [react()],
});

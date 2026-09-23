import { defineConfig, loadEnv } from "vite";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, ".", "VITE_");

  return {
    server: {
      port: 5173,
      proxy: { "/api": env.VITE_API_PROXY_TARGET || "http://localhost:8000" },
    },
  };
});

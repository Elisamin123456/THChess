import { defineConfig, loadEnv } from "vite";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");

  return {
    root: "pubilc",
    base: env.VITE_APP_BASE || "/",
    build: {
      outDir: "../dist",
      emptyOutDir: true,
    },
  };
});

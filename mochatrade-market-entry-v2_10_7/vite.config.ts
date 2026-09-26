import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    globals: true,
    // Tests never hit the network (see setup.ts); this only lets the live
    // REST Countries path run against mocked fetch instead of bailing out
    // for a missing key.
    env: { VITE_RESTCOUNTRIES_KEY: "test-key" },
  },
});

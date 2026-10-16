import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// dossier du projet, avec des / (aussi sous Windows)
const root = fileURLToPath(new URL(".", import.meta.url)).replace(/\\/g, "/");

export default defineConfig({
  resolve: {
    alias: [
      { find: /^@\/(.*)$/, replacement: `${root}$1` },
      // "server-only" refuse d'être importé hors du serveur Next : neutralisé pour les tests
      { find: /^server-only$/, replacement: `${root}tests/unit/server-only-stub.ts` },
    ],
  },
  oxc: { jsx: { runtime: "automatic" } },
  test: {
    include: ["tests/unit/**/*.test.{ts,tsx}"],
    environment: "node",
    env: { ADMIN_TIMEZONE: "Europe/Paris" },
  },
});

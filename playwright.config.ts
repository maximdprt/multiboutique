// Tests de bout en bout (navigateur) en mode démo : npm run test:e2e
// Le serveur est lancé sur le port 3100 avec une base de démo neuve (.data/e2e-db.json),
// et toutes les clés vidées : même avec un .env.local rempli, rien ne touche aux vrais services.
import { defineConfig, devices } from "@playwright/test";

const PORT = 3100;
const CI = Boolean(process.env.CI);

// Variables vidées pour forcer le mode démo (Next ne remplace pas une variable déjà définie, même vide).
const DEMO_ENV = Object.fromEntries(
  [
    "SUPABASE_URL",
    "SUPABASE_SERVICE_ROLE_KEY",
    "ADMIN_PASSWORD",
    "ADMIN_HOST",
    "STRIPE_SECRET_KEY",
    "STRIPE_WEBHOOK_SECRET",
    "CJ_API_KEY",
    "ANTHROPIC_API_KEY",
    "RESEND_API_KEY",
    "TELEGRAM_BOT_TOKEN",
    "TELEGRAM_CHAT_ID",
    "INDEXNOW_KEY",
    "DEFAULT_SITE",
  ].map((k) => [k, ""]),
);

const reset = `node -e "require('fs').rmSync('.data/e2e-db.json',{force:true})"`;

export default defineConfig({
  testDir: "tests/e2e",
  // une seule base de démo partagée : les tests s'enchaînent
  workers: 1,
  fullyParallel: false,
  retries: CI ? 1 : 0,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: `http://localhost:${PORT}`,
    locale: "fr-FR",
    timezoneId: "Europe/Paris",
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    // en CI le build est déjà fait par l'étape précédente
    command: CI ? `${reset} && npx next start -p ${PORT}` : `${reset} && npm run build && npx next start -p ${PORT}`,
    url: `http://localhost:${PORT}/admin/login`,
    reuseExistingServer: false,
    timeout: 240_000,
    env: { ...DEMO_ENV, DEMO_DB_PATH: ".data/e2e-db.json", NODE_ENV: "production" },
  },
});

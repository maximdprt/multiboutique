// Test de rendu : npm run rendu
// Parcourt une boutique exemple et l'admin, sur ordinateur et sur mobile, vérifie le rendu
// (pas de débordement, images chargées, couleurs du thème, aucune erreur) et enregistre une capture
// de chaque page dans rendu/, avec une planche rendu/index.html à ouvrir dans le navigateur.
// Même serveur que les tests de bout en bout : mode démo, base neuve, aucune clé.
import { defineConfig, devices } from "@playwright/test";
import base from "./playwright.config";

export default defineConfig({
  ...base,
  testDir: "tests/rendu",
  reporter: "list",
  projects: [
    { name: "ordinateur", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } } },
    { name: "mobile", use: { ...devices["Pixel 7"] } },
  ],
});

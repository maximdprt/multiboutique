import { expect, test } from "@playwright/test";
import { login } from "./helpers";

test("l'admin est protégé et refuse un mauvais mot de passe", async ({ page }) => {
  await page.goto("/admin/commandes");
  await expect(page).toHaveURL(/\/admin\/login\?next=%2Fadmin%2Fcommandes$/);
  await expect(page.getByText("Mode démo : le mot de passe est « demo ».")).toBeVisible();

  await page.getByLabel("Mot de passe").fill("mauvais");
  await page.getByRole("button", { name: "Se connecter" }).click();
  await expect(page.getByText("Mot de passe incorrect.")).toBeVisible();
});

test("se connecter à l'admin et voir le rapport du matin", async ({ page }) => {
  await login(page);
  await expect(page.getByRole("navigation", { name: "Menu de l'admin" })).toBeVisible();
  await expect(page.getByText("Mode démo : données fictives.")).toBeVisible();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(/Bonjour|Bon après-midi|Bonsoir/);
});

test("la page État des services s'affiche sans aucun secret", async ({ page }) => {
  await login(page, "/admin/reglages/services");
  await expect(page.getByRole("heading", { name: "Réglages" })).toBeVisible();
  await expect(page.getByRole("link", { name: "État des services" })).toHaveAttribute("aria-current", "page");
  const list = page.getByRole("list", { name: "État des services" });
  for (const name of ["Base de données (Supabase)", "Paiement (Stripe)", "Retour de paiement (webhook Stripe)", "Commandes fournisseur (CJ Dropshipping)", "Agents IA (Anthropic)", "E-mails (Resend)", "Rapport sur Telegram", "IndexNow (Bing et assistants IA)", "Tâches planifiées"])
    await expect(list.getByText(name, { exact: true })).toBeVisible();
  await expect(page.locator('[data-service="supabase"] .badge')).toHaveText("À configurer");

  // « Que faire ? » déplie la marche à suivre
  await page.locator('[data-service="stripe"] summary').click();
  await expect(page.locator('[data-service="stripe"]').getByText("Variables : STRIPE_SECRET_KEY")).toBeVisible();

  await expect(page.getByRole("table")).toContainText("Rapport du matin");
});

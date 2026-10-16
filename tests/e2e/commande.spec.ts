import { expect, test } from "@playwright/test";
import { login, shopUrl } from "./helpers";

test("passer une commande puis la retrouver dans l'admin, envoyée au fournisseur", async ({ page }) => {
  // 1. La boutique de démo
  await page.goto(shopUrl("bocal", "/produits/bocaux-verre-hermetiques-lot-6"));
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  const title = (await page.getByRole("heading", { level: 1 }).textContent())!.trim();

  // 2. Ajout au panier (2 exemplaires)
  await page.getByRole("button", { name: "Ajouter un" }).click();
  await page.getByRole("button", { name: "Ajouter au panier" }).click();
  await page.getByRole("link", { name: "Voir le panier" }).click();
  await expect(page).toHaveURL(shopUrl("bocal", "/panier"));
  await expect(page.getByRole("link", { name: title, exact: true }).last()).toBeVisible();

  // 3. Paiement simulé (mode démo, sans Stripe)
  await page.getByRole("button", { name: "Payer la commande" }).click();
  await expect(page).toHaveURL(/\/merci\?commande=\d+$/);
  await expect(page.getByRole("heading", { name: "Merci, votre commande est confirmée." })).toBeVisible();
  const number = new URL(page.url()).searchParams.get("commande")!;

  // 4. La commande dans l'admin
  await login(page, `/admin/commandes?q=${number}`);
  const row = page.getByRole("row").filter({ hasText: `#${number}` });
  await expect(row).toContainText("démo");
  await expect(row).toContainText("Bocal & Cie");
  await row.getByRole("link", { name: `#${number}` }).click();

  // 5. Envoi fournisseur simulé, fait automatiquement après le paiement
  await expect(page.getByRole("heading", { name: `Commande #${number}` })).toBeVisible();
  await expect(page.getByText(title).first()).toBeVisible();
  await expect(async () => {
    await page.reload();
    await expect(page.getByText(`DEMO-${number}`)).toBeVisible({ timeout: 1000 });
  }).toPass({ timeout: 15_000 });
  await expect(page.getByText("Simulation (mode démo, pas de clé CJ)")).toBeVisible();
  await expect(page.locator(".page-head .status")).toHaveText("Transmise au fournisseur");
});

import { expect, test } from "@playwright/test";
import { login } from "./helpers";

test("l'adresse d'aperçu affiche la boutique, sans indexation, et la navigation y reste", async ({ page }) => {
  const res = await page.goto("/apercu/chat");
  expect(res?.headers()["x-robots-tag"]).toBe("noindex, nofollow");
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
  await expect(page.getByRole("status")).toContainText("Aperçu");
  await expect(page.locator(".wordmark")).toHaveText("Chat Perché");

  // Les liens gardent le préfixe /apercu/chat
  await page.getByRole("navigation", { name: "Navigation principale" }).getByRole("link", { name: "Produits" }).click();
  await expect(page).toHaveURL(/\/apercu\/chat\/produits$/);
  await page.locator("a.tile").first().click();
  await expect(page).toHaveURL(/\/apercu\/chat\/produits\/[a-z0-9-]+$/);

  // Commande simulée depuis l'aperçu : on revient sur l'aperçu
  await page.getByRole("button", { name: "Ajouter au panier" }).click();
  await page.getByRole("link", { name: "Voir le panier" }).click();
  await expect(page).toHaveURL(/\/apercu\/chat\/panier$/);
  await page.getByRole("button", { name: "Payer la commande" }).click();
  await expect(page).toHaveURL(/\/apercu\/chat\/merci\?commande=\d+$/);
  await expect(page.locator(".wordmark")).toHaveText("Chat Perché");
});

test("ajouter un domaine depuis l'admin, voir ses DNS, le suivre jusqu'à « En ligne »", async ({ page }) => {
  await login(page, "/admin/boutiques/bocal/domaine");
  await expect(page.getByRole("link", { name: "Domaine" }).first()).toHaveAttribute("aria-current", "page");
  const status = page.locator("[data-domain-status]");
  await expect(status).toHaveAttribute("data-domain-status", "a_ajouter");

  await page.getByRole("button", { name: "Ajouter ce domaine" }).click();
  await expect(page.getByText("Domaine ajouté. Créez maintenant les enregistrements DNS ci-dessous.")).toBeVisible();
  await expect(status).toHaveAttribute("data-domain-status", "dns");
  const dns = page.getByRole("table", { name: "Enregistrements DNS" });
  await expect(dns).toContainText("76.76.21.21");
  await expect(dns).toContainText("www");
  await expect(dns.getByRole("button", { name: /Copier : 76\.76\.21\.21/ })).toBeVisible();

  // Mode démo : une étape franchie à chaque vérification
  for (const next of ["verification", "certificat", "en_ligne"]) {
    await page.getByRole("button", { name: "Vérifier maintenant" }).click();
    await expect(status).toHaveAttribute("data-domain-status", next);
  }
  await expect(status.locator(".badge")).toHaveText("En ligne");

  // Dernière étape : déclarer le domaine à Google, rappelée dans le rapport du matin
  await expect(page.locator('[data-next="declarer"]')).toContainText("Google Search Console");
  await page.getByRole("button", { name: "C'est fait" }).click();
  await expect(page.getByText("Noté : le domaine est déclaré")).toBeVisible();
  await expect(page.locator('[data-next="declarer"] .badge')).toHaveText("Fait");
});

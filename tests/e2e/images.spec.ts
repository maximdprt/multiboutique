import { expect, test } from "@playwright/test";
import sharp from "sharp";
import { login } from "./helpers";

/** Photo de test : un objet sur fond blanc (motif différent selon `seed`). */
async function photo(seed: number) {
  const shapes = seed === 1 ? `<circle cx="800" cy="800" r="420" fill="#264653"/><circle cx="800" cy="800" r="180" fill="#e9c46a"/>` : `<rect x="380" y="300" width="840" height="1000" rx="80" fill="#e76f51"/><rect x="560" y="480" width="480" height="640" fill="#f4a261"/>`;
  return sharp(Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="1600"><rect width="100%" height="100%" fill="#fff"/>${shapes}</svg>`))
    .jpeg({ quality: 90 })
    .toBuffer();
}

test("l'agent Images range les photos, contrôle leur qualité, et la fiche produit les affiche en galerie", async ({ page }) => {
  await login(page, "/admin/produits/p-bocal-1");
  const panel = page.locator("#images");
  await expect(panel.getByRole("heading", { name: /Images \(1\/8\)/ })).toBeVisible();
  await expect(panel.getByText("Non contrôlée")).toBeVisible();

  // 1. Récupération : l'illustration de démo est contrôlée, mise au propre et rangée chez nous
  await panel.getByRole("button", { name: "Récupérer les images" }).click();
  await expect(panel.getByRole("status")).toContainText("1 image(s) importée(s)");
  await expect(panel.getByText(/Qualité \d+\/100/)).toBeVisible();
  await expect(panel.locator(".img-thumb img").first()).toHaveAttribute("src", /medias/);

  // 2. Envoi de deux photos depuis l'ordinateur
  await panel.locator('input[type="file"]').setInputFiles([
    { name: "vue-1.jpg", mimeType: "image/jpeg", buffer: await photo(1) },
    { name: "vue-2.jpg", mimeType: "image/jpeg", buffer: await photo(2) },
  ]);
  await panel.getByRole("button", { name: "Envoyer" }).click();
  await expect(panel.getByRole("status")).toContainText("2 image(s) importée(s)");
  await expect(panel.getByRole("heading", { name: /Images \(3\/8\)/ })).toBeVisible();

  // 3. La deuxième devient la photo principale
  await panel.locator(".img-card").nth(1).getByRole("button", { name: "Principale" }).click();
  await expect(panel.getByRole("status")).toContainText("Photo principale changée.");

  // 4. Sur la boutique : galerie à 3 photos, miniatures, flèches, plein écran
  await page.goto("/apercu/bocal/produits/bocaux-verre-hermetiques-lot-6");
  const gallery = page.getByLabel(/Photos de /).first();
  await expect(gallery.locator(".g-count")).toHaveText("1 / 3");
  await gallery.getByRole("button", { name: "Voir la photo 3" }).click();
  await expect(gallery.locator(".g-count")).toHaveText("3 / 3");
  await gallery.getByRole("button", { name: "Agrandir la photo 3 sur 3" }).click();
  const lightbox = page.locator("dialog.g-lightbox");
  await expect(lightbox).toBeVisible();
  await page.keyboard.press("ArrowRight");
  await expect(lightbox.locator(".g-count")).toHaveText("1 / 3");
  await page.keyboard.press("Escape");
  await expect(lightbox).toBeHidden();
  // les images servies sont les nôtres
  const srcs = await gallery.locator(".g-track img").evaluateAll((imgs) => imgs.map((i) => (i as HTMLImageElement).currentSrc));
  expect(srcs.every((s) => s.includes("medias"))).toBe(true);
});

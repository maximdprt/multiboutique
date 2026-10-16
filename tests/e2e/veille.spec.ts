import { expect, test, type Page } from "@playwright/test";
import { login } from "./helpers";

/** Attend la fin de la prochaine action serveur (enregistrement d'une décision). */
const actionDone = (page: Page) => page.waitForResponse((r) => r.request().method() === "POST" && Boolean(r.request().headers()["next-action"]));

test("trier une carte de veille, puis annuler", async ({ page }) => {
  await login(page, "/admin/veille");
  const card = page.locator(".stack-card.panel");
  await expect(card).toBeVisible();
  const product = (await card.getByRole("heading", { level: 3 }).textContent())!.trim();
  const count = Number((await page.locator(".stack-count").textContent())!.match(/\d+/)![0]);

  // Écarter : la carte suivante apparaît
  await page.getByRole("button", { name: "← Écarter" }).click();
  await expect(page.getByText(`« ${product} » écartée.`)).toBeVisible();
  if (count > 1) await expect(card.getByRole("heading", { level: 3 })).not.toHaveText(product);

  // La décision est enregistrée (en arrière-plan) : l'idée passe dans l'onglet « Écartées »
  await expect(async () => {
    await page.goto("/admin/veille?vue=ecartees");
    await expect(page.getByRole("heading", { level: 3, name: product })).toBeVisible({ timeout: 1000 });
  }).toPass({ timeout: 15_000 });

  // Garder pour plus tard (clavier ↓), puis annuler
  await page.goto("/admin/veille");
  const next = (await card.getByRole("heading", { level: 3 }).textContent())!.trim();
  const kept = actionDone(page);
  await page.keyboard.press("ArrowDown");
  await expect(page.getByText(`« ${next} » gardée pour plus tard.`)).toBeVisible();
  await kept;
  const undone = actionDone(page);
  await page.getByRole("button", { name: "Annuler", exact: true }).click();
  await expect(card.getByRole("heading", { level: 3 })).toHaveText(next);
  await undone;
  // l'idée est revenue dans « Nouvelles », et n'est pas dans « Retenues »
  await page.goto("/admin/veille?liste=1");
  await expect(page.getByRole("heading", { level: 3, name: next })).toBeVisible();
  await page.goto("/admin/veille?vue=retenues");
  await expect(page.getByRole("heading", { level: 3, name: next })).toHaveCount(0);
});

import { expect, type Page } from "@playwright/test";

export const PORT = 3100;
/** Adresse d'une boutique de démo : bocal.localhost, chat.localhost… */
export const shopUrl = (id: string, path = "/") => `http://${id}.localhost:${PORT}${path}`;

/** Connexion à l'admin avec le mot de passe de démo. */
export async function login(page: Page, next = "/admin") {
  await page.goto(`/admin/login?next=${encodeURIComponent(next)}`);
  await page.getByLabel("Mot de passe").fill("demo");
  await page.getByRole("button", { name: "Se connecter" }).click();
  await expect(page).toHaveURL(new RegExp(`${next.replace(/[?]/g, "\\?")}$`));
}

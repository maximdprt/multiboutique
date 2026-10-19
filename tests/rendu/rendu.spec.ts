import fs from "node:fs";
import path from "node:path";
import { expect, test, type Page, type TestInfo } from "@playwright/test";
import { login } from "../e2e/helpers";

// Boutique exemple : Bocal & Cie (rangement de cuisine), vue sur son adresse d'aperçu.
const SHOP = { id: "bocal", name: "Bocal & Cie", primary: "#2d5a43", background: "#f2f4ef" };
const OUT = path.join(process.cwd(), "rendu");

type Shot = { project: string; key: string; title: string; url: string; file: string; checks: string[] };

/** Contrôles de rendu communs à chaque page. */
async function checkRender(page: Page, errors: string[]) {
  const checks: string[] = [];
  // Rien ne dépasse en largeur (pas de défilement horizontal, surtout sur mobile)
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow, "la page déborde en largeur").toBeLessThanOrEqual(1);
  checks.push("Aucun débordement horizontal");

  // Toutes les images sont chargées (on force le chargement des images différées)
  await page.evaluate(async () => {
    await Promise.all(
      Array.from(document.images).map((img) => {
        img.loading = "eager";
        return img.complete ? null : new Promise((r) => (img.addEventListener("load", r, { once: true }), img.addEventListener("error", r, { once: true })));
      }),
    );
  });
  const broken = await page.evaluate(() => Array.from(document.images).filter((i) => i.complete && i.naturalWidth === 0).map((i) => i.currentSrc || i.src));
  expect(broken, "images cassées").toEqual([]);
  checks.push(`${await page.evaluate(() => document.images.length)} image(s) chargée(s)`);

  // Un seul titre principal, des liens et boutons avec un nom lisible
  await expect(page.locator("h1")).toHaveCount(1);
  const unnamed = await page.evaluate(
    () =>
      Array.from(document.querySelectorAll("a, button")).filter((e) => (e as HTMLElement).offsetParent && !(e.textContent?.trim() || e.getAttribute("aria-label")))
        .length,
  );
  expect(unnamed, "liens ou boutons sans nom").toBe(0);
  checks.push("Un titre principal, liens et boutons nommés");

  expect(errors, "erreurs dans la console").toEqual([]);
  checks.push("Aucune erreur dans la console");
  return checks;
}

const shots: Shot[] = [];

async function capture(page: Page, info: TestInfo, key: string, title: string, errors: string[], extra: string[] = []) {
  await page.evaluate(() => document.fonts.ready);
  const checks = [...extra, ...(await checkRender(page, errors))];
  const dir = path.join(OUT, info.project.name);
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `${key}.png`);
  await page.screenshot({ path: file, fullPage: true, animations: "disabled" });
  const u = new URL(page.url());
  shots.push({ project: info.project.name, key, title, url: u.pathname + u.search, file: path.relative(OUT, file).replace(/\\/g, "/"), checks });
}

function watchErrors(page: Page) {
  const errors: string[] = [];
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  page.on("pageerror", (e) => errors.push(e.message));
  return errors;
}

test.describe.configure({ mode: "serial" });

test("boutique exemple : accueil, catalogue, fiche, guides, panier, confirmation", async ({ page }, info) => {
  const errors = watchErrors(page);
  const res = await page.goto(`/apercu/${SHOP.id}`);
  expect(res?.headers()["x-robots-tag"]).toContain("noindex");
  await expect(page.locator(".wordmark")).toHaveText(SHOP.name);
  // Les couleurs du thème de la boutique sont bien appliquées
  const vars = await page.evaluate(() => {
    const s = getComputedStyle(document.documentElement);
    return { primary: s.getPropertyValue("--primary").trim(), bg: s.getPropertyValue("--bg").trim() };
  });
  expect(vars).toEqual({ primary: SHOP.primary, bg: SHOP.background });
  await capture(page, info, "1-accueil", "Accueil", errors, [`Thème appliqué (principale ${SHOP.primary}, fond ${SHOP.background})`, "Aperçu non indexé (X-Robots-Tag)"]);

  await page.goto(`/apercu/${SHOP.id}/produits`);
  await capture(page, info, "2-catalogue", "Catalogue", errors);

  await page.locator("a.tile").first().click();
  await expect(page).toHaveURL(/\/produits\/[a-z0-9-]+$/);
  const ld = await page.locator('script[type="application/ld+json"]').allTextContents();
  expect(ld.join(" ")).toContain('"Product"');
  await capture(page, info, "3-fiche-produit", "Fiche produit", errors, ["Données structurées Product présentes"]);

  await page.getByRole("button", { name: "Ajouter au panier" }).click();
  await expect(page.locator(".cart-count")).toHaveText("1");

  await page.goto(`/apercu/${SHOP.id}/guides`);
  await capture(page, info, "4-guides", "Liste des guides", errors);
  await page.locator("main a[href*='/guides/']").first().click();
  await expect(page).toHaveURL(/\/guides\/[a-z0-9-]+$/);
  await capture(page, info, "5-guide", "Guide", errors);

  await page.goto(`/apercu/${SHOP.id}/panier`);
  await expect(page.getByRole("button", { name: "Payer la commande" })).toBeVisible();
  await capture(page, info, "6-panier", "Panier", errors);

  await page.getByRole("button", { name: "Payer la commande" }).click();
  await expect(page).toHaveURL(/\/merci\?commande=\d+$/);
  await capture(page, info, "7-confirmation", "Confirmation de commande", errors, ["Paiement simulé (mode démo)"]);

  await page.goto(`/apercu/${SHOP.id}/mentions-legales`);
  await capture(page, info, "8-mentions-legales", "Mentions légales", errors);
});

test("admin : rapport du matin, analyse et domaine de la boutique exemple", async ({ page }, info) => {
  const errors = watchErrors(page);
  await login(page);
  await capture(page, info, "a1-aujourdhui", "Admin : Aujourd'hui", errors);
  await page.goto(`/admin/boutiques/${SHOP.id}/apercu`);
  await capture(page, info, "a2-analyse", "Admin : analyse de la boutique", errors);
  await page.goto(`/admin/boutiques/${SHOP.id}/domaine`);
  const add = page.getByRole("button", { name: "Ajouter ce domaine" });
  if (await add.isVisible()) await add.click();
  await expect(page.getByRole("table", { name: "Enregistrements DNS" })).toBeVisible();
  await capture(page, info, "a3-domaine", "Admin : onglet Domaine", errors);
});

test.afterAll(async ({}, info) => {
  // Planche de toutes les captures (ordinateur et mobile s'ajoutent au même fichier)
  const manifest = path.join(OUT, "captures.json");
  const all: Shot[] = fs.existsSync(manifest) ? JSON.parse(fs.readFileSync(manifest, "utf8")) : [];
  const merged = [...all.filter((s) => s.project !== info.project.name), ...shots];
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(manifest, JSON.stringify(merged, null, 2));
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");
  const section = (p: string) =>
    merged
      .filter((s) => s.project === p)
      .map(
        (s) =>
          `<figure><figcaption><b>${esc(s.title)}</b> <code>${esc(s.url)}</code><ul>${s.checks.map((c) => `<li>✓ ${esc(c)}</li>`).join("")}</ul></figcaption><a href="${s.file}"><img src="${s.file}" alt="${esc(s.title)}" loading="lazy"></a></figure>`,
      )
      .join("");
  fs.writeFileSync(
    path.join(OUT, "index.html"),
    `<!doctype html><meta charset="utf-8"><title>Rendu : ${SHOP.name}</title><style>body{font:15px system-ui;margin:24px;background:#f6f6f4}h2{margin-top:32px}.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(var(--w),1fr));gap:20px}figure{margin:0;background:#fff;border-radius:10px;padding:12px;box-shadow:0 1px 3px #0002}img{width:100%;border:1px solid #ddd;border-radius:6px}ul{margin:6px 0 10px;padding-left:0;list-style:none;color:#2d6a3e;font-size:13px}code{color:#666;font-size:12px}</style><h1>Test de rendu : ${SHOP.name}</h1><p>Généré le ${new Date().toLocaleString("fr-FR")} par <code>npm run rendu</code>.</p><h2>Ordinateur (1440 px)</h2><div class="grid" style="--w:420px">${section("ordinateur")}</div><h2>Mobile (Pixel 7)</h2><div class="grid" style="--w:260px">${section("mobile")}</div>`,
  );
});

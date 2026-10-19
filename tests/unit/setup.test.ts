import { describe, expect, it } from "vitest";
import sodium from "libsodium-wrappers";
import {
  GENERATED,
  linkedTo,
  nodeOk,
  parseEnv,
  productionUrl,
  repoFromRemote,
  secretsForGithub,
  setEnvValue,
  varsForVercel,
} from "../../scripts/setup-lib.mjs";

describe("fichier .env.local", () => {
  const text = "# Admin\nADMIN_PASSWORD=\nADMIN_SECRET=abc\n\n# Divers\nREPORT_FROM=\"Rapports <r@x.fr>\"\r\nDEFAULT_SITE=\n";

  it("lit les valeurs, guillemets et fins de ligne Windows compris", () => {
    expect(parseEnv(text)).toEqual({ ADMIN_PASSWORD: "", ADMIN_SECRET: "abc", REPORT_FROM: "Rapports <r@x.fr>", DEFAULT_SITE: "" });
  });

  it("remplace une valeur sans toucher aux commentaires, ou l'ajoute à la fin", () => {
    const t = setEnvValue(setEnvValue(text, "ADMIN_SECRET", "x$1y"), "APP_URL", "https://a.vercel.app");
    expect(t).toContain("# Admin\nADMIN_PASSWORD=\nADMIN_SECRET=x$1y\n");
    expect(t.trimEnd().endsWith("APP_URL=https://a.vercel.app")).toBe(true);
    expect(parseEnv(setEnvValue(text, "ADMIN_PASSWORD", "mot de passe")).ADMIN_PASSWORD).toBe("mot de passe");
    expect(parseEnv(setEnvValue("A=1\nB=2\nA=3\n", "A", "9"))).toEqual({ A: "9", B: "2" });
  });

  it("génère des secrets au bon format", () => {
    expect(GENERATED.ADMIN_SECRET()).toMatch(/^[0-9a-f]{48}$/);
    expect(GENERATED.INDEXNOW_KEY()).toMatch(/^[0-9a-f]{32}$/);
    expect(GENERATED.CRON_SECRET()).not.toBe(GENERATED.CRON_SECRET());
  });
});

describe("envoi vers Vercel et GitHub", () => {
  const values = { ADMIN_PASSWORD: "secret", SUPABASE_URL: "https://a.supabase.co", SUPABASE_DB_URL: "postgresql://x", GITHUB_TOKEN: "ghp_x", STRIPE_SECRET_KEY: " ", APP_URL: "https://a.vercel.app" };

  it("n'envoie à Vercel que les variables remplies, jamais celles réservées à l'ordinateur", () => {
    const vars = varsForVercel(values);
    expect(vars.map((v) => v.key)).toEqual(["ADMIN_PASSWORD", "SUPABASE_URL", "APP_URL"]);
    expect(vars[0]).toEqual({ key: "ADMIN_PASSWORD", value: "secret", type: "encrypted", target: ["production", "preview"] });
  });

  it("choisit les secrets GitHub Actions utiles", () => {
    expect(secretsForGithub(values).map((s) => s.name)).toEqual(["SUPABASE_URL", "SUPABASE_DB_URL", "APP_URL"]);
  });

  it("chiffre un secret comme l'exige GitHub (boîte scellée libsodium)", async () => {
    await sodium.ready;
    const kp = sodium.crypto_box_keypair();
    const key = sodium.to_base64(kp.publicKey, sodium.base64_variants.ORIGINAL);
    const enc = sodium.crypto_box_seal(sodium.from_string("valeur"), sodium.from_base64(key, sodium.base64_variants.ORIGINAL));
    expect(sodium.to_string(sodium.crypto_box_seal_open(enc, kp.publicKey, kp.privateKey))).toBe("valeur");
  });
});

describe("projet Vercel", () => {
  it("reconnaît le dépôt GitHub", () => {
    expect(repoFromRemote("https://github.com/maximdprt/multiboutique.git\n")).toBe("maximdprt/multiboutique");
    expect(repoFromRemote("git@github.com:maximdprt/multiboutique.git")).toBe("maximdprt/multiboutique");
    expect(repoFromRemote("https://gitlab.com/a/b.git")).toBeNull();
    expect(linkedTo({ link: { type: "github", org: "MaximDprt", repo: "multiboutique" } }, "maximdprt/multiboutique")).toBe(true);
    expect(linkedTo({ link: { type: "gitlab", org: "maximdprt", repo: "multiboutique" } }, "maximdprt/multiboutique")).toBe(false);
  });

  it("trouve l'adresse de production stable", () => {
    expect(productionUrl({ name: "mb", targets: { production: { alias: ["mb-git-main-moi.vercel.app", "mb-moi.vercel.app"] } } })).toBe("https://mb-moi.vercel.app");
    expect(productionUrl({ name: "mb", alias: [{ domain: "mb.vercel.app", target: "PRODUCTION" }] })).toBe("https://mb.vercel.app");
    expect(productionUrl({ name: "mb" })).toBe("https://mb.vercel.app");
  });

  it("vérifie la version de Node", () => {
    expect(nodeOk("v22.12.0")).toBe(true);
    expect(nodeOk("24.1.0")).toBe(true);
    expect(nodeOk("22.11.9")).toBe(false);
    expect(nodeOk("20.19.0")).toBe(false);
  });
});

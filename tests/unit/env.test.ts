import { describe, expect, it } from "vitest";
import { envSchema, readEnv, serviceStatuses } from "@/lib/env";

const PROD = {
  ADMIN_PASSWORD: "un-long-mot-de-passe",
  ADMIN_SECRET: "a".repeat(40),
  SUPABASE_URL: "https://abcd.supabase.co",
  SUPABASE_SERVICE_ROLE_KEY: "eyJhbGciOiJIUzI1NiJ9.secret-de-test",
  STRIPE_SECRET_KEY: "sk_test_51ABCDEF",
  STRIPE_WEBHOOK_SECRET: "whsec_abcdef",
  CRON_SECRET: "b".repeat(32),
};

describe("readEnv", () => {
  it("n'exige rien en mode démo", () => {
    const r = readEnv({});
    expect(r.mode).toBe("demo");
    expect(r.issues).toEqual([]);
  });

  it("traite une variable vide comme absente", () => {
    expect(readEnv({ STRIPE_SECRET_KEY: "", CJ_PAY_MODE: "  " }).issues).toEqual([]);
  });

  it("accepte une configuration de production complète", () => {
    const r = readEnv({ ...PROD, VERCEL: "1" });
    expect(r.mode).toBe("production");
    expect(r.issues).toEqual([]);
    expect(envSchema.safeParse({ ...PROD, VERCEL: "1" }).success).toBe(true);
  });

  it("exige le mot de passe et le secret de l'admin dès que Supabase est configuré", () => {
    const keys = readEnv({ SUPABASE_URL: PROD.SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY: PROD.SUPABASE_SERVICE_ROLE_KEY }).issues.map((i) => i.key);
    expect(keys).toEqual(expect.arrayContaining(["ADMIN_PASSWORD", "ADMIN_SECRET"]));
  });

  it("signale les variables qui vont par deux", () => {
    const keys = (s: Record<string, string>) => readEnv(s).issues.map((i) => i.key);
    expect(keys({ SUPABASE_URL: PROD.SUPABASE_URL })).toContain("SUPABASE_SERVICE_ROLE_KEY");
    expect(keys({ STRIPE_SECRET_KEY: PROD.STRIPE_SECRET_KEY })).toContain("STRIPE_WEBHOOK_SECRET");
    expect(keys({ TELEGRAM_BOT_TOKEN: "123456:ABCDEFGHIJKLMNOPQRSTUVWXYZ" })).toContain("TELEGRAM_CHAT_ID");
    expect(keys({ REPORT_EMAIL: "moi@exemple.fr" })).toContain("REPORT_FROM");
  });

  it("exige CRON_SECRET sur Vercel seulement", () => {
    const { CRON_SECRET: _omit, ...rest } = PROD;
    expect(readEnv(rest).issues).toEqual([]);
    expect(readEnv({ ...rest, VERCEL: "1" }).issues.map((i) => i.key)).toEqual(["CRON_SECRET"]);
  });

  it("vérifie le format, avec un message qui dit quoi faire", () => {
    const r = readEnv({
      STRIPE_SECRET_KEY: "pk_test_123",
      STRIPE_WEBHOOK_SECRET: "whsec_x",
      SUPABASE_URL: "abcd.supabase.co",
      CJ_PAY_MODE: "carte",
      AUTO_FULFILL_MAX_CENTS: "150 €",
      ADMIN_TIMEZONE: "Paris",
      REPORT_EMAIL: "pas-une-adresse",
      REPORT_FROM: "Rapports <rapport@exemple.fr>",
    });
    const msg = Object.fromEntries(r.issues.map((i) => [i.key, i.message]));
    expect(msg.STRIPE_SECRET_KEY).toBe("Doit commencer par sk_test_ ou sk_live_.");
    expect(msg.SUPABASE_URL).toContain("https://");
    expect(msg.CJ_PAY_MODE).toBe("Mettez balance ou manual.");
    expect(msg.AUTO_FULFILL_MAX_CENTS).toContain("centimes");
    expect(msg.ADMIN_TIMEZONE).toContain("Europe/Paris");
    expect(msg.REPORT_EMAIL).toBe("Adresse e-mail invalide.");
    expect(r.values.STRIPE_SECRET_KEY).toBeUndefined();
    expect(r.values.STRIPE_WEBHOOK_SECRET).toBe("whsec_x");
  });
});

describe("serviceStatuses", () => {
  it("n'affiche jamais la valeur d'un secret", () => {
    const secrets = { ...PROD, ANTHROPIC_API_KEY: "sk-ant-api03-SECRET", CJ_API_KEY: "CJ-SECRET-123456", TELEGRAM_BOT_TOKEN: "123456:SECRETSECRETSECRETSECRET", TELEGRAM_CHAT_ID: "42", RESEND_API_KEY: "re_SECRET" };
    const json = JSON.stringify(serviceStatuses(secrets));
    for (const k of ["ADMIN_PASSWORD", "ADMIN_SECRET", "SUPABASE_SERVICE_ROLE_KEY", "STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET", "CRON_SECRET"] as const)
      expect(json).not.toContain(PROD[k]);
    for (const v of ["sk-ant-api03-SECRET", "CJ-SECRET-123456", "SECRETSECRETSECRETSECRET", "re_SECRET"]) expect(json).not.toContain(v);
  });

  it("donne l'état de chaque service et quoi faire", () => {
    const { mode, services } = serviceStatuses({ ...PROD, CJ_PAY_MODE: "carte" });
    const by = Object.fromEntries(services.map((s) => [s.id, s]));
    expect(mode).toBe("production");
    expect(Object.keys(by)).toEqual(["admin", "supabase", "stripe", "webhook", "cj", "anthropic", "resend", "telegram", "indexnow", "domaines", "cron", "audience"]);
    expect(by.supabase).toMatchObject({ state: "ok", required: true });
    expect(by.stripe.detail).toContain("Clé de test");
    expect(by.anthropic).toMatchObject({ state: "absent", required: false });
    expect(by.anthropic.todo.length).toBeGreaterThan(0);
    expect(by.cj.state).toBe("a_corriger");
    expect(by.cj.problems).toEqual(["CJ_PAY_MODE : Mettez balance ou manual."]);
  });

  it("en mode démo, seul Supabase est indispensable", () => {
    const { mode, services } = serviceStatuses({});
    expect(mode).toBe("demo");
    expect(services.filter((s) => s.required).map((s) => s.id)).toEqual(["supabase"]);
    expect(services.find((s) => s.id === "admin")?.detail).toContain("« demo »");
  });
});

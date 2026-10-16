import { siteFromHost, siteUrl } from "@/lib/sites";

export const revalidate = 3600;

// Les robots des moteurs IA sont explicitement autorisés : c'est la base du GEO
// (être lu, donc pouvoir être cité, par ChatGPT, Claude, Perplexity, Gemini…).
const AI_BOTS = ["GPTBot", "OAI-SearchBot", "ChatGPT-User", "ClaudeBot", "Claude-SearchBot", "Claude-User", "PerplexityBot", "Google-Extended", "Applebot-Extended", "Bingbot"];

export async function GET(_req: Request, { params }: { params: Promise<{ host: string }> }) {
  const site = await siteFromHost((await params).host);
  if (!site) return new Response("User-agent: *\nDisallow: /\n", { headers: { "Content-Type": "text/plain" } });
  const disallow = ["/panier", "/merci", "/api/", "/admin"];
  const block = (ua: string) => `User-agent: ${ua}\n${disallow.map((d) => `Disallow: ${d}`).join("\n")}\nAllow: /\n`;
  const body = [block("*"), ...AI_BOTS.map(block), `Sitemap: ${siteUrl(site, "/sitemap.xml")}`].join("\n");
  return new Response(body + "\n", { headers: { "Content-Type": "text/plain; charset=utf-8" } });
}

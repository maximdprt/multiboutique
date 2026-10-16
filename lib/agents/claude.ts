import "server-only";
// Appel à Claude (API Anthropic) avec recherche web, qui renvoie un résultat structuré
// via un outil "enregistrer…" dont on fournit le schéma JSON.
import Anthropic from "@anthropic-ai/sdk";

export const hasClaude = () => Boolean(process.env.ANTHROPIC_API_KEY);
export const MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-5-5";

type Tool = { name: string; description: string; schema: Record<string, unknown> };

export async function structured<T>(opts: {
  system: string;
  prompt: string;
  tool: Tool;
  searches?: number; // nombre maximal de recherches web
  maxTokens?: number;
  log?: (line: string) => void;
}): Promise<{ data: T; sources: string[] }> {
  const client = new Anthropic();
  const tools: Anthropic.Messages.ToolUnion[] = [];
  if (opts.searches)
    tools.push({
      type: "web_search_20250305",
      name: "web_search",
      max_uses: opts.searches,
      user_location: { type: "approximate", country: "FR", timezone: "Europe/Paris" },
    });
  tools.push({ name: opts.tool.name, description: opts.tool.description, input_schema: opts.tool.schema as Anthropic.Messages.Tool.InputSchema });

  const messages: Anthropic.Messages.MessageParam[] = [{ role: "user", content: opts.prompt }];
  const sources = new Set<string>();
  let force = !opts.searches;

  for (let turn = 0; turn < 10; turn++) {
    // en flux (stream) : obligatoire pour les longues rédactions, et évite les coupures réseau
    const res = await client.messages
      .stream({
        model: MODEL,
        max_tokens: opts.maxTokens ?? 16000,
        system: opts.system,
        tools,
        tool_choice: force ? { type: "tool", name: opts.tool.name } : { type: "auto" },
        messages,
      })
      .finalMessage();

    for (const b of res.content) {
      if (b.type === "server_tool_use" && b.name === "web_search") {
        const q = (b.input as { query?: string })?.query;
        if (q) opts.log?.(`Recherche web : « ${q} »`);
      }
      if (b.type === "web_search_tool_result" && Array.isArray(b.content)) {
        for (const r of b.content) if (r.type === "web_search_result") sources.add(r.url);
      }
      if (b.type === "tool_use" && b.name === opts.tool.name) {
        return { data: b.input as T, sources: [...sources] };
      }
    }

    messages.push({ role: "assistant", content: res.content });
    if (res.stop_reason === "pause_turn") continue; // recherche longue : on relance tel quel
    if (res.stop_reason === "max_tokens") throw new Error("Réponse trop longue : l'agent a été interrompu.");
    // pas encore d'enregistrement : on le demande explicitement
    messages.push({ role: "user", content: `Enregistre maintenant ton résultat final avec l'outil ${opts.tool.name}.` });
    force = true;
  }
  throw new Error("L'agent n'a pas produit de résultat.");
}

/** Schéma JSON : petites aides pour rester lisible. */
export const S = {
  str: (description: string) => ({ type: "string", description }),
  num: (description: string) => ({ type: "number", description }),
  arr: (items: object, description: string) => ({ type: "array", items, description }),
  obj: (properties: Record<string, object>, required = Object.keys(properties)) => ({ type: "object", properties, required }),
  enumOf: (values: string[], description: string) => ({ type: "string", enum: values, description }),
};

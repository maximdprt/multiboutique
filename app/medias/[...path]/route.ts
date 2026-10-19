// Mode démo : sert les images enregistrées dans .data/medias (en production, elles sont sur Supabase Storage).
import { readLocalFile } from "@/lib/storage";

const TYPES: Record<string, string> = { webp: "image/webp", avif: "image/avif", jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", svg: "image/svg+xml" };

export async function GET(_req: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const p = (await params).path.join("/");
  try {
    const data = await readLocalFile(p);
    return new Response(new Uint8Array(data), {
      headers: { "Content-Type": TYPES[p.split(".").pop() ?? ""] ?? "application/octet-stream", "Cache-Control": "public, max-age=31536000, immutable" },
    });
  } catch {
    return new Response("Introuvable", { status: 404 });
  }
}

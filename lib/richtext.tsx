// Mise en forme simple des textes saisis dans l'admin :
//   ## Titre        -> sous-titre
//   ### Titre       -> sous-sous-titre
//   - élément       -> liste à puces
//   **gras**        -> gras
//   [texte](/url)   -> lien
// Ligne vide = nouveau paragraphe. Aucun HTML n'est interprété (pas de risque d'injection).
import type { ReactNode } from "react";

type Block = { type: "h2" | "h3" | "p"; text: string } | { type: "ul"; items: string[] };

export function parseBlocks(src: string): Block[] {
  const blocks: Block[] = [];
  for (const chunk of src.replace(/\r/g, "").split(/\n{2,}/)) {
    const lines = chunk.split("\n").map((l) => l.trimEnd()).filter(Boolean);
    if (!lines.length) continue;
    let para: string[] = [];
    let list: string[] = [];
    const flush = () => {
      if (para.length) blocks.push({ type: "p", text: para.join("\n") });
      if (list.length) blocks.push({ type: "ul", items: list });
      para = [];
      list = [];
    };
    for (const line of lines) {
      if (line.startsWith("### ")) {
        flush();
        blocks.push({ type: "h3", text: line.slice(4) });
      } else if (line.startsWith("## ")) {
        flush();
        blocks.push({ type: "h2", text: line.slice(3) });
      } else if (/^[-*] /.test(line)) {
        if (para.length) flush();
        list.push(line.slice(2));
      } else {
        if (list.length) flush();
        para.push(line.trim());
      }
    }
    flush();
  }
  return blocks;
}

function inline(text: string, keyBase: string): ReactNode[] {
  const out: ReactNode[] = [];
  const re = /\*\*(.+?)\*\*|\[([^\]]+)\]\(([^)\s]+)\)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    if (m[1]) out.push(<strong key={`${keyBase}-${i++}`}>{m[1]}</strong>);
    else {
      const href = m[3];
      const safe = /^(https?:\/\/|\/|#)/.test(href) ? href : "#";
      out.push(
        <a key={`${keyBase}-${i++}`} href={safe} {...(safe.startsWith("http") ? { rel: "noopener" } : {})}>
          {m[2]}
        </a>,
      );
    }
    last = re.lastIndex;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

export function RichText({ source, className }: { source: string; className?: string }) {
  return (
    <div className={className}>
      {parseBlocks(source).map((b, i) => {
        const k = String(i);
        if (b.type === "ul")
          return (
            <ul key={k}>
              {b.items.map((it, j) => (
                <li key={j}>{inline(it, `${k}-${j}`)}</li>
              ))}
            </ul>
          );
        const Tag = b.type;
        const lines = b.text.split("\n");
        return (
          <Tag key={k}>
            {lines.map((l, j) => (
              <span key={j}>
                {j > 0 && <br />}
                {inline(l, `${k}-${j}`)}
              </span>
            ))}
          </Tag>
        );
      })}
    </div>
  );
}

/** Version texte brut (meta descriptions, llms.txt, données structurées). */
export function plainText(src: string) {
  return src
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/^#{2,3} /gm, "")
    .replace(/^[-*] /gm, "• ")
    .replace(/\n{2,}/g, "\n")
    .trim();
}

export function truncate(s: string, max = 158) {
  const t = s.replace(/\s+/g, " ").trim();
  if (t.length <= max) return t;
  const cut = t.slice(0, max - 1);
  return cut.slice(0, cut.lastIndexOf(" ")) + "…";
}

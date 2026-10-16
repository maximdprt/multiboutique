"use client";
// Tri des idées de la veille, une carte à la fois.
// Glisser à droite (ou →) : lancer la boutique. À gauche (ou ←) : écarter. Bas (ou ↓) : garder pour plus tard.
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { setOpportunityStatus } from "../../agent-actions";

export type Card = {
  id: string;
  product: string;
  niche: string;
  score: number;
  summary: string;
  why_now: string;
  competition: string;
  price_range: string;
  margin_hint: string;
  queries: string[];
  links: { label: string; url: string; note?: string }[];
};

const COMP: Record<string, string> = { faible: "good", moyenne: "warn", forte: "bad" };

async function setStatus(id: string, status: string) {
  const f = new FormData();
  f.set("id", id);
  f.set("status", status);
  await setOpportunityStatus(f);
}

export function CardStack({ cards }: { cards: Card[] }) {
  const router = useRouter();
  const [queue, setQueue] = useState(cards);
  const [last, setLast] = useState<{ card: Card; status: string } | null>(null);
  const [dx, setDx] = useState(0);
  const [leaving, setLeaving] = useState<"left" | "right" | "down" | null>(null);
  const start = useRef<{ x: number; y: number } | null>(null);
  const card = queue[0];

  const decide = async (dir: "left" | "right" | "down") => {
    if (!card || leaving) return;
    setLeaving(dir);
    if (dir === "right") {
      router.push(`/admin/boutiques/creer?opportunite=${card.id}`);
      return;
    }
    const status = dir === "left" ? "ecartee" : "retenue";
    setTimeout(async () => {
      setQueue((q) => q.slice(1));
      setLast({ card, status });
      setLeaving(null);
      setDx(0);
      await setStatus(card.id, status);
    }, 220);
  };

  const undo = async () => {
    if (!last) return;
    setQueue((q) => [last.card, ...q]);
    await setStatus(last.card.id, "nouvelle");
    setLast(null);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.closest("input, textarea, select")) return;
      if (e.key === "ArrowRight") decide("right");
      if (e.key === "ArrowLeft") decide("left");
      if (e.key === "ArrowDown") decide("down");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  if (!card)
    return (
      <section className="panel">
        <p className="empty-row">
          Toutes les idées sont triées.{" "}
          {last && (
            <button type="button" className="link-btn" onClick={undo}>
              Annuler la dernière décision
            </button>
          )}
        </p>
      </section>
    );

  const offset = leaving === "left" ? -700 : leaving === "right" ? 700 : dx;
  const style = {
    transform: leaving === "down" ? "translateY(120px) scale(0.96)" : `translateX(${offset}px) rotate(${offset / 25}deg)`,
    opacity: leaving ? 0 : 1,
    transition: start.current ? "none" : "transform 0.22s ease, opacity 0.22s ease",
  };
  const hint = dx > 60 ? "Lancer" : dx < -60 ? "Écarter" : null;

  return (
    <div className="deck">
      <p className="muted stack-count">
        {queue.length} idée{queue.length > 1 ? "s" : ""} à trier. Clavier : ← écarter, ↓ garder, → lancer.
      </p>
      <div className="stack-area">
        {queue[1] && <div className="stack-card behind" aria-hidden="true" />}
        <article
          className="stack-card panel"
          style={style}
          onPointerDown={(e) => {
            if ((e.target as HTMLElement).closest("a, button")) return;
            start.current = { x: e.clientX, y: e.clientY };
            (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
          }}
          onPointerMove={(e) => start.current && setDx(e.clientX - start.current.x)}
          onPointerUp={() => {
            const d = dx;
            start.current = null;
            if (d > 120) decide("right");
            else if (d < -120) decide("left");
            else setDx(0);
          }}
        >
          {hint && <span className={`stack-hint ${dx > 0 ? "go" : "no"}`}>{hint}</span>}
          <div className="opp-head">
            <div>
              <h3>{card.product}</h3>
              <p className="niche">{card.niche}</p>
            </div>
            <div className="score">
              <b>{card.score}</b>
              <small>sur 100</small>
            </div>
          </div>
          <p>{card.summary}</p>
          <p className="muted">
            <b>Pourquoi maintenant :</b> {card.why_now}
          </p>
          <div className="facts">
            <span>
              Concurrence Google <span className={`badge ${COMP[card.competition] ?? ""}`}>{card.competition}</span>
            </span>
            <span>
              Prix <b>{card.price_range}</b>
            </span>
            <span>
              Coût et marge <b>{card.margin_hint}</b>
            </span>
          </div>
          {card.queries.length > 0 && (
            <div className="qchips">
              {card.queries.map((q) => (
                <span key={q}>{q}</span>
              ))}
            </div>
          )}
          {card.links.length > 0 && (
            <div className="links">
              Liens trouvés :{" "}
              {card.links.map((l) => (
                <a key={l.url} href={l.url} target="_blank" rel="noopener noreferrer" title={l.note}>
                  {l.label}
                </a>
              ))}
            </div>
          )}
        </article>
      </div>
      <div className="stack-actions">
        <button type="button" className="btn quiet" onClick={() => decide("left")}>
          ← Écarter
        </button>
        <button type="button" className="btn quiet" onClick={() => decide("down")}>
          Garder pour plus tard
        </button>
        <button type="button" className="btn" onClick={() => decide("right")}>
          Lancer la boutique →
        </button>
      </div>
      {last && (
        <p className="stack-undo">
          « {last.card.product} » {last.status === "ecartee" ? "écartée" : "gardée pour plus tard"}.{" "}
          <button type="button" className="link-btn" onClick={undo}>
            Annuler
          </button>
        </p>
      )}
    </div>
  );
}

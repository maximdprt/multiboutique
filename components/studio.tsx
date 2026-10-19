"use client";
// Effets du gabarit « Studio » : apparition au défilement, aimant, texte révélé lettre par lettre,
// bandeaux d'images liés au défilement, cartes empilées. Sans librairie : React + CSS, pour rester
// léger (objectif Lighthouse ≥ 90). Tout s'arrête si le visiteur a demandé moins d'animations.
import { Fragment, useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { withBase } from "@/lib/store-path";
import { useStore } from "./store";

const EASE = "cubic-bezier(0.25, 0.1, 0.25, 1)";
const reducedMotion = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Apparaît (fondu + glissement) quand l'élément entre dans l'écran, une seule fois. */
export function FadeIn({
  children,
  delay = 0,
  duration = 0.7,
  x = 0,
  y = 30,
  className = "",
  style,
}: {
  children: ReactNode;
  delay?: number;
  duration?: number;
  x?: number;
  y?: number;
  className?: string;
  style?: CSSProperties;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (reducedMotion() || !("IntersectionObserver" in window)) return setShown(true);
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setShown(true);
          io.disconnect();
        }
      },
      { rootMargin: "50px", threshold: 0 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <div
      ref={ref}
      className={`fade ${className}`}
      style={{
        ...style,
        opacity: shown ? 1 : 0,
        transform: shown ? "none" : `translate3d(${x}px, ${y}px, 0)`,
        transition: `opacity ${duration}s ${EASE} ${delay}s, transform ${duration}s ${EASE} ${delay}s`,
      }}
    >
      {children}
    </div>
  );
}

/** Effet d'aimant : l'élément suit légèrement la souris quand elle passe à moins de `padding` px. */
export function Magnet({ children, padding = 150, strength = 3, className = "" }: { children: ReactNode; padding?: number; strength?: number; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || reducedMotion() || !window.matchMedia("(pointer: fine)").matches) return;
    let active = false;
    const move = (e: MouseEvent) => {
      const r = el.getBoundingClientRect();
      const near = e.clientX > r.left - padding && e.clientX < r.right + padding && e.clientY > r.top - padding && e.clientY < r.bottom + padding;
      if (near) {
        const dx = (e.clientX - (r.left + r.width / 2)) / strength;
        const dy = (e.clientY - (r.top + r.height / 2)) / strength;
        el.style.transition = "transform 0.3s ease-out";
        el.style.transform = `translate3d(${dx}px, ${dy}px, 0)`;
        active = true;
      } else if (active) {
        el.style.transition = "transform 0.6s ease-in-out";
        el.style.transform = "translate3d(0, 0, 0)";
        active = false;
      }
    };
    window.addEventListener("mousemove", move, { passive: true });
    return () => window.removeEventListener("mousemove", move);
  }, [padding, strength]);
  return (
    <div ref={ref} className={className} style={{ willChange: "transform" }}>
      {children}
    </div>
  );
}

/** Avancement du défilement d'un élément, de 0 à 1, entre deux repères de l'écran (fractions de la hauteur). */
function useScrollProgress<T extends HTMLElement>(start: number, end: number, onProgress: (p: number, el: T) => void) {
  const ref = useRef<T>(null);
  const cb = useRef(onProgress);
  cb.current = onProgress;
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (reducedMotion()) return cb.current(1, el);
    let frame = 0;
    const update = () => {
      frame = 0;
      const r = el.getBoundingClientRect();
      const vh = window.innerHeight;
      // début : le haut de l'élément atteint `start` ; fin : le bas de l'élément atteint `end`
      const p = (start * vh - r.top) / (start * vh - end * vh + r.height);
      cb.current(Math.min(1, Math.max(0, p)), el);
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [start, end]);
  return ref;
}

/** Texte révélé lettre par lettre au fil du défilement (opacité 0,2 -> 1). */
export function RevealText({ text, className = "" }: { text: string; className?: string }) {
  const ref = useScrollProgress<HTMLParagraphElement>(0.8, 0.2, (p, el) => el.style.setProperty("--p", String(p)));
  const words = text.split(/\s+/).filter(Boolean);
  const n = text.replace(/\s+/g, "").length || 1;
  let i = 0;
  return (
    <p ref={ref} className={`reveal ${className}`} style={{ "--p": 0, "--n": n } as CSSProperties}>
      <span className="sr-only">{text}</span>
      <span aria-hidden="true">
        {words.map((w, wi) => (
          <Fragment key={wi}>
            <span className="reveal-word">
              {Array.from(w).map((c, ci) => (
                <span key={ci} style={{ "--s": (i++) / n } as CSSProperties}>
                  {c}
                </span>
              ))}
            </span>{" "}
          </Fragment>
        ))}
      </span>
    </p>
  );
}

export type MarqueeItem = { href: string; src: string; label: string };

/** Deux bandeaux d'images qui glissent en sens inverse quand on fait défiler la page. */
export function Marquee({ rows }: { rows: [MarqueeItem[], MarqueeItem[]] }) {
  const { base } = useStore();
  const r1 = useRef<HTMLDivElement>(null);
  const r2 = useRef<HTMLDivElement>(null);
  const ref = useScrollProgress<HTMLElement>(1, 0, (_p, el) => {
    if (reducedMotion()) return;
    const top = el.getBoundingClientRect().top + window.scrollY;
    const offset = (window.scrollY - top + window.innerHeight) * 0.3;
    // chaque bandeau contient 3 fois la série : on part décalé d'une série pour ne jamais montrer de vide
    const set = (r1.current?.scrollWidth ?? 0) / 3;
    if (r1.current) r1.current.style.transform = `translate3d(${offset - set}px, 0, 0)`;
    if (r2.current) r2.current.style.transform = `translate3d(${-offset}px, 0, 0)`;
  });
  const row = (items: MarqueeItem[], r: typeof r1) => (
    <div ref={r} className="marquee-row" style={{ willChange: "transform" }}>
      {[0, 1, 2].flatMap((copy) =>
        items.map((it, k) => (
          <a
            key={`${copy}-${k}`}
            href={withBase(base, it.href)}
            className="marquee-tile"
            aria-label={copy === 1 ? it.label : undefined}
            aria-hidden={copy === 1 ? undefined : true}
            tabIndex={copy === 1 ? undefined : -1}
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- images de tailles variées, chargées à la demande */}
            <img src={it.src} alt="" loading="lazy" decoding="async" width={420} height={270} />
          </a>
        )),
      )}
    </div>
  );
  return (
    <section ref={ref} className="marquee" aria-label="Aperçu des produits">
      {row(rows[0], r1)}
      {row(rows[1], r2)}
    </section>
  );
}

/** Cartes collées en haut de l'écran qui rapetissent à mesure que la suivante les recouvre. */
export function StackCards({ children }: { children: ReactNode[] }) {
  const n = children.length;
  const cards = useRef<(HTMLDivElement | null)[]>([]);
  const ref = useScrollProgress<HTMLDivElement>(0, 1, (p) => {
    cards.current.forEach((card, i) => {
      if (!card) return;
      const target = 1 - (n - 1 - i) * 0.03;
      const from = i / n;
      const t = Math.min(1, Math.max(0, (p - from) / (1 - from)));
      card.style.transform = `scale(${1 - (1 - target) * t})`;
    });
  });
  return (
    <div ref={ref} className="stack">
      {children.map((child, i) => (
        <div key={i} className="stack-slot">
          <div
            ref={(el) => {
              cards.current[i] = el;
            }}
            className="stack-card"
            style={{ top: `calc(var(--stack-top) + ${i * 28}px)` }}
          >
            {child}
          </div>
        </div>
      ))}
    </div>
  );
}

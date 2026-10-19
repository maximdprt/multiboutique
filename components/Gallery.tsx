"use client";
// Galerie de la fiche produit, comme sur les meilleures boutiques :
//  - mobile : on fait glisser les photos au doigt (défilement aimanté), avec des points et un compteur ;
//  - ordinateur : grande photo, miniatures cliquables, flèches, zoom qui suit la souris ;
//  - clic (ou Entrée) : plein écran, flèches du clavier, Échap pour fermer.
import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";

export type GalleryImage = { src: string; alt: string; width?: number; height?: number };

export function Gallery({ images, title }: { images: GalleryImage[]; title: string }) {
  const [index, setIndex] = useState(0);
  const [zoom, setZoom] = useState<{ x: number; y: number } | null>(null);
  const [open, setOpen] = useState(false);
  const track = useRef<HTMLDivElement>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const n = images.length;

  const go = useCallback(
    (i: number, smooth = true) => {
      const next = (i + n) % n;
      setIndex(next);
      const el = track.current;
      if (el) el.scrollTo({ left: next * el.clientWidth, behavior: smooth ? "smooth" : "auto" });
    },
    [n],
  );

  // Le défilement au doigt met à jour la photo courante
  useEffect(() => {
    const el = track.current;
    if (!el) return;
    let t = 0;
    const onScroll = () => {
      cancelAnimationFrame(t);
      t = requestAnimationFrame(() => setIndex(Math.round(el.scrollLeft / Math.max(1, el.clientWidth))));
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const d = dialog.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") go(index + 1, false);
      if (e.key === "ArrowLeft") go(index - 1, false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, index, go]);

  if (!n) return <div className="gallery gallery-empty" aria-hidden="true" />;

  return (
    <div className="gallery" aria-roledescription="carrousel" aria-label={`Photos de ${title}`}>
      <div className="g-stage">
        <div ref={track} className="g-track" tabIndex={-1}>
          {images.map((img, i) => (
            <button
              key={img.src}
              type="button"
              className="g-slide media"
              aria-label={`Agrandir la photo ${i + 1} sur ${n}`}
              onClick={() => setOpen(true)}
              onMouseMove={(e) => {
                if (window.matchMedia("(hover: hover)").matches) {
                  const r = e.currentTarget.getBoundingClientRect();
                  setZoom({ x: ((e.clientX - r.left) / r.width) * 100, y: ((e.clientY - r.top) / r.height) * 100 });
                }
              }}
              onMouseLeave={() => setZoom(null)}
            >
              <Image
                src={img.src}
                alt={img.alt}
                fill
                sizes="(max-width: 860px) 100vw, 640px"
                priority={i === 0}
                unoptimized={img.src.endsWith(".svg")}
                style={i === index && zoom ? { transform: "scale(1.9)", transformOrigin: `${zoom.x}% ${zoom.y}%` } : undefined}
              />
            </button>
          ))}
        </div>
        {n > 1 && (
          <>
            <button type="button" className="g-arrow g-prev" aria-label="Photo précédente" onClick={() => go(index - 1)}>
              <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
                <path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            <button type="button" className="g-arrow g-next" aria-label="Photo suivante" onClick={() => go(index + 1)}>
              <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
                <path d="M9 5l7 7-7 7" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            <span className="g-count" aria-live="polite">
              {index + 1} / {n}
            </span>
            <div className="g-dots" aria-hidden="true">
              {images.map((img, i) => (
                <i key={img.src} className={i === index ? "on" : ""} />
              ))}
            </div>
          </>
        )}
      </div>
      {n > 1 && (
        <div className="thumbs" role="group" aria-label="Choisir une photo">
          {images.map((img, i) => (
            <button key={img.src} type="button" className="media g-thumb" aria-label={`Voir la photo ${i + 1}`} aria-current={i === index} onClick={() => go(i)}>
              <Image src={img.src} alt="" fill sizes="88px" unoptimized={img.src.endsWith(".svg")} />
            </button>
          ))}
        </div>
      )}

      <dialog ref={dialog} className="g-lightbox" aria-label={`Photos de ${title} en plein écran`} onClose={() => setOpen(false)} onClick={(e) => e.target === e.currentTarget && setOpen(false)}>
        {open && (
          <>
            <div className="g-lb-img">
              <Image src={images[index].src} alt={images[index].alt} fill sizes="100vw" unoptimized={images[index].src.endsWith(".svg")} />
            </div>
            <button type="button" className="g-lb-close" aria-label="Fermer" onClick={() => setOpen(false)} autoFocus>
              ×
            </button>
            {n > 1 && (
              <>
                <button type="button" className="g-arrow g-prev" aria-label="Photo précédente" onClick={() => go(index - 1, false)}>
                  ‹
                </button>
                <button type="button" className="g-arrow g-next" aria-label="Photo suivante" onClick={() => go(index + 1, false)}>
                  ›
                </button>
                <span className="g-count">
                  {index + 1} / {n}
                </span>
              </>
            )}
          </>
        )}
      </dialog>
    </div>
  );
}

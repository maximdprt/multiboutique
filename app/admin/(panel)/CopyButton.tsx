"use client";
import { useState } from "react";

/** Bouton « Copier » : met la valeur dans le presse-papiers. */
export function CopyButton({ value, label = "Copier" }: { value: string; label?: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      className="btn quiet small"
      aria-label={`${label} : ${value}`}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setDone(true);
          setTimeout(() => setDone(false), 1500);
        } catch {
          // presse-papiers refusé : la valeur reste sélectionnable à la main
        }
      }}
    >
      {done ? "Copié" : label}
    </button>
  );
}

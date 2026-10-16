// Petits éléments partagés des pages admin (rendus côté serveur).
import type { ReactNode } from "react";
import { percent } from "@/lib/format";
import type { Site } from "@/lib/types";

/** Tendance sur 12 points maximum : période en couleur, sans axes. */
export function Sparkline({ values, color = "var(--series-1)" }: { values: number[]; color?: string }) {
  if (values.length < 2) return null;
  const W = 200;
  const H = 34;
  const max = Math.max(...values, 1);
  const pts = values.map((v, i) => `${((i / (values.length - 1)) * W).toFixed(1)},${(H - 3 - (v / max) * (H - 6)).toFixed(1)}`);
  return (
    <svg className="spark" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden="true">
      <polyline points={pts.join(" ")} fill="none" stroke={color} strokeWidth={2} vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
    </svg>
  );
}

export function Delta({ v, invert = false, suffix = "" }: { v: number | null; invert?: boolean; suffix?: string }) {
  if (v === null || !Number.isFinite(v)) return <span className="delta">—</span>;
  const up = v >= 0;
  const good = invert ? !up : up;
  return (
    <span className={`delta ${Math.abs(v) < 0.005 ? "" : good ? "up" : "down"}`} title="Par rapport à la période précédente">
      {up ? "↗" : "↘"} {percent(Math.abs(v), 1)}
      {suffix}
    </span>
  );
}

export function Metric({
  label,
  value,
  delta,
  spark,
  hero,
  hint,
}: {
  label: string;
  value: ReactNode;
  delta?: ReactNode;
  spark?: ReactNode;
  hero?: boolean;
  hint?: string;
}) {
  return (
    <div className={`metric${hero ? " hero" : ""}`}>
      <span className="label" title={hint}>
        {label}
      </span>
      <div className="row">
        <span className="value">{value}</span>
        {delta}
      </div>
      {spark}
    </div>
  );
}

export const PERIOD_LABEL: Record<number, string> = { 1: "Aujourd'hui", 7: "7 jours", 30: "30 jours", 90: "3 mois", 365: "12 mois" };

export function PeriodSeg({ days, base, options = [1, 7, 30, 90, 365] }: { days: number; base: string; options?: number[] }) {
  return (
    <nav className="seg" aria-label="Période">
      {options.map((d) => (
        <a key={d} href={`${base}${base.includes("?") ? "&" : "?"}jours=${d}`} aria-current={d === days ? "true" : undefined}>
          {PERIOD_LABEL[d] ?? `${d} jours`}
        </a>
      ))}
    </nav>
  );
}

export function Scope({ site, color, dark }: { site: Site | null; color?: string; dark?: boolean }) {
  return (
    <div className="scope">
      {site ? (
        <span className={`fav${dark ? " dark-text" : ""}`} style={{ background: color }} aria-hidden="true">
          {site.name.charAt(0)}
        </span>
      ) : (
        <span className="fav all" aria-hidden="true" />
      )}
      {site ? site.domain : "Toutes les boutiques"}
    </div>
  );
}

export function HBars({ rows, unit = "" }: { rows: { key: string; label: ReactNode; value: number; color?: string }[]; unit?: string }) {
  const max = Math.max(...rows.map((r) => r.value), 1);
  const total = rows.reduce((s, r) => s + r.value, 0) || 1;
  return (
    <ul className="hbars">
      {rows.map((r) => (
        <li key={r.key}>
          <span className="name">{r.label}</span>
          <span className="val">
            {new Intl.NumberFormat("fr-FR").format(r.value)}
            {unit}
            <small>{percent(r.value / total)}</small>
          </span>
          <span className="track" aria-hidden="true">
            <span className="fill" style={{ width: `${(r.value / max) * 100}%`, display: "block", background: r.color }} />
          </span>
        </li>
      ))}
    </ul>
  );
}

export function parseDays(v: string | undefined, allowed = [7, 30, 90], fallback = 30) {
  const n = Number(v);
  return allowed.includes(n) ? n : fallback;
}

/** Filtre par boutique : des pastilles cliquables, "Toutes" en premier. */
export function SiteFilter({
  sites,
  colors,
  current,
  base,
  keep = {},
}: {
  sites: Site[];
  colors: Record<string, string>;
  current: string | undefined;
  base: string;
  keep?: Record<string, string | number | undefined>;
}) {
  const href = (site?: string) => {
    const u = new URLSearchParams();
    for (const [k, v] of Object.entries({ ...keep, site })) if (v !== undefined && v !== "") u.set(k, String(v));
    const q = u.toString();
    return q ? `${base}?${q}` : base;
  };
  return (
    <nav className="chips" aria-label="Filtrer par boutique">
      <a href={href()} aria-current={!current ? "true" : undefined}>
        Toutes les boutiques
      </a>
      {sites.map((s) => (
        <a key={s.id} href={href(s.id)} aria-current={current === s.id ? "true" : undefined}>
          <i className="dot" style={{ background: colors[s.id] }} />
          {s.name}
        </a>
      ))}
    </nav>
  );
}

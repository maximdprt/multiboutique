"use client";
// Barres par jour, empilées par boutique (euros ou nombres). Survol = détail du jour.
import { useState } from "react";

type Point = { key: string; label: string; bySite: Record<string, number>; total: number; orders: number };
type Series = { id: string; name: string; color: string };

type Unit = "eur" | "count";
const fmtEur = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
const fmtNum = new Intl.NumberFormat("fr-FR");
const show = (v: number, u: Unit) => (u === "eur" ? fmtEur.format(Math.round(v / 100)) : fmtNum.format(v));
const axis = (v: number, u: Unit) => {
  const e = u === "eur" ? v / 100 : v;
  const s = e >= 1000 ? `${(e / 1000).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} k` : `${e}`;
  return u === "eur" ? `${s}${e >= 1000 ? "" : " "}€` : s;
};

function niceMax(v: number, u: Unit) {
  const scale = u === "eur" ? 100 : 1;
  if (v <= 0) return 10 * scale;
  const e = v / scale;
  const pow = Math.pow(10, Math.floor(Math.log10(e)));
  const n = [1, 2, 2.5, 5, 10].find((m) => m * pow >= e) ?? 10;
  return n * pow * scale;
}

/** Rectangle aux coins supérieurs arrondis (bout de barre), base carrée. */
function topRounded(x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.min(r, w / 2, h);
  return `M${x},${y + h}V${y + rr}Q${x},${y} ${x + rr},${y}H${x + w - rr}Q${x + w},${y} ${x + w},${y + rr}V${y + h}Z`;
}

export function BarChart({
  points,
  series,
  unit = "eur",
  label,
  countLabel = "commande",
}: {
  points: Point[];
  series: Series[];
  unit?: Unit;
  label: string;
  countLabel?: string;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const W = 960;
  const H = 260;
  const m = { t: 10, r: 8, b: 26, l: 52 };
  const iw = W - m.l - m.r;
  const ih = H - m.t - m.b;
  const max = niceMax(Math.max(...points.map((p) => p.total), 0), unit);
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => f * max);
  const band = iw / Math.max(points.length, 1);
  const bw = Math.max(2, Math.min(24, band - 2));
  const y = (v: number) => m.t + ih - (v / max) * ih;
  const every = Math.ceil(points.length / 8);
  const hp = hover !== null ? points[hover] : null;
  const stacked = series.length > 1;

  return (
    <div className="chart">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label} onMouseLeave={() => setHover(null)}>
        <g className="grid">
          {ticks.map((t) => (
            <line key={t} x1={m.l} x2={W - m.r} y1={y(t)} y2={y(t)} />
          ))}
        </g>
        <g className="axis">
          {ticks.map((t) => (
            <text key={t} x={m.l - 8} y={y(t) + 4} textAnchor="end">
              {axis(t, unit)}
            </text>
          ))}
          {points.map((p, i) =>
            i % every === 0 ? (
              <text key={p.key} x={m.l + band * i + band / 2} y={H - 6} textAnchor="middle">
                {p.label}
              </text>
            ) : null,
          )}
        </g>
        {points.map((p, i) => {
          const x = m.l + band * i + (band - bw) / 2;
          const segs = series.map((s) => ({ s, v: p.bySite[s.id] ?? 0 })).filter((d) => d.v > 0);
          let acc = 0;
          return (
            <g key={p.key}>
              {segs.map((d, j) => {
                const top = y(acc + d.v);
                const bottom = y(acc);
                acc += d.v;
                const gap = j > 0 ? 2 : 0; // 2 px d'espace entre segments empilés
                const h = Math.max(0, bottom - top - gap);
                if (h <= 0) return null;
                return j === segs.length - 1 ? (
                  <path key={d.s.id} d={topRounded(x, top, bw, h, 3)} fill={d.s.color} />
                ) : (
                  <rect key={d.s.id} x={x} y={top} width={bw} height={h} fill={d.s.color} />
                );
              })}
              <rect
                className={`hit${hover === i ? " on" : ""}`}
                x={m.l + band * i}
                y={m.t}
                width={band}
                height={ih}
                onMouseEnter={() => setHover(i)}
              />
            </g>
          );
        })}
      </svg>
      {hp && (
        <div
          className="tip"
          style={{
            left: `${((m.l + band * (hover! + 0.5)) / W) * 100}%`,
            top: 0,
            transform: hover! > points.length * 0.6 ? "translateX(calc(-100% - 12px))" : "translateX(12px)",
          }}
        >
          <strong>{hp.label}</strong>
          {stacked &&
            series.map((s) => (
              <div key={s.id}>
                <span>
                  <i className="dot" style={{ background: s.color }} />
                  {s.name}
                </span>
                <span>{show(hp.bySite[s.id] ?? 0, unit)}</span>
              </div>
            ))}
          <div className={stacked ? "tot" : ""}>
            <span>{unit === "eur" ? `${hp.orders} ${countLabel}${hp.orders > 1 ? "s" : ""}` : "Total"}</span>
            <span>{show(hp.total, unit)}</span>
          </div>
        </div>
      )}
    </div>
  );
}

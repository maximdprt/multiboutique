"use client";
import { usePathname } from "next/navigation";
import { Icon } from "./icons";

const NAV = [
  { href: "/admin", label: "Ventes", icon: "analytics" },
  { href: "/admin/commandes", label: "Commandes", icon: "orders", count: true },
  { href: "/admin/veille", label: "Veille", icon: "search" },
  { href: "/admin/boutiques", label: "Boutiques", icon: "store" },
  { href: "/admin/agents", label: "Agents", icon: "health" },
];

export function Sidebar({ toHandle, running }: { toHandle: number; running: number }) {
  const path = usePathname();
  const isCurrent = (href: string) =>
    href === "/admin"
      ? path === "/admin"
      : path.startsWith(href) || (href === "/admin/boutiques" && (path.startsWith("/admin/produits") || path.startsWith("/admin/guides")));
  return (
    <nav className="side" aria-label="Menu de l'admin">
      {NAV.map((n) => (
        <a key={n.href} href={n.href} aria-current={isCurrent(n.href) ? "page" : undefined}>
          <Icon name={n.icon} />
          {n.label}
          {n.count && toHandle > 0 && (
            <span className="count" aria-label={`${toHandle} à traiter`}>
              {toHandle}
            </span>
          )}
          {n.href === "/admin/agents" && running > 0 && (
            <span className="count live" aria-label={`${running} en cours`}>
              {running} en cours
            </span>
          )}
        </a>
      ))}
    </nav>
  );
}

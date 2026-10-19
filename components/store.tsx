"use client";
// Contexte de la boutique affichée : sa base d'adresse ("" sur son domaine, "/apercu/<id>" en aperçu).
// StoreLink préfixe les liens internes, pour que la navigation reste dans l'aperçu.
import { createContext, useContext, type AnchorHTMLAttributes, type ReactNode } from "react";
import { withBase } from "@/lib/store-path";

type Store = { siteId: string; base: string; preview: boolean };

const StoreContext = createContext<Store>({ siteId: "", base: "", preview: false });

export function StoreProvider({ siteId, base, children }: { siteId: string; base: string; children: ReactNode }) {
  return <StoreContext.Provider value={{ siteId, base, preview: Boolean(base) }}>{children}</StoreContext.Provider>;
}

export function useStore() {
  return useContext(StoreContext);
}

/** Lien interne de la boutique : <StoreLink href="/produits"> devient /apercu/<id>/produits en aperçu. */
export function StoreLink({ href, ...rest }: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) {
  const { base } = useStore();
  return <a {...rest} href={withBase(base, href)} />;
}

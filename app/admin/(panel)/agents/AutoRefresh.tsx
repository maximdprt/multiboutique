"use client";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

/** Rafraîchit la page toutes les 3 secondes tant qu'un agent travaille. */
export function AutoRefresh({ active }: { active: boolean }) {
  const router = useRouter();
  useEffect(() => {
    if (!active) return;
    const t = setInterval(() => router.refresh(), 3000);
    return () => clearInterval(t);
  }, [active, router]);
  return null;
}

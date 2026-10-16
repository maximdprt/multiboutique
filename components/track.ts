"use client";
import { useEffect } from "react";

/** Envoie un signal de mesure d'audience (sans cookie, sans identifiant stocké). */
export function track(t: "pageview" | "add_to_cart" | "checkout") {
  try {
    const u = new URLSearchParams(location.search).get("utm_source") ?? "";
    const body = JSON.stringify({ t, p: location.pathname, r: t === "pageview" ? document.referrer : location.href, u: t === "pageview" ? u : "" });
    if (navigator.sendBeacon) navigator.sendBeacon("/api/collect", new Blob([body], { type: "text/plain" }));
    else fetch("/api/collect", { method: "POST", body, keepalive: true });
  } catch {}
}

export function PageviewTracker() {
  useEffect(() => {
    track("pageview");
  }, []);
  return null;
}

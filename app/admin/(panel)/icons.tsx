// Icônes du menu (traits simples, 20 × 20).
const P: Record<string, string> = {
  city: "M3 17V9l4-2v10M7 17V5l5-2v14M12 17V8l5 2v7M2 17h16M9 7h1M9 10h1M9 13h1M14 12h1M14 14.5h1",
  home: "M3 9.5 10 4l7 5.5V16a1 1 0 0 1-1 1h-3.5v-5h-5v5H4a1 1 0 0 1-1-1z",
  orders: "M4 4h12l-1 12H5zM7.5 4V3.5a2.5 2.5 0 0 1 5 0V4M7 9h6",
  products: "M3.5 10.2 10.2 3.5H16.5v6.3l-6.7 6.7a1 1 0 0 1-1.4 0l-4.9-4.9a1 1 0 0 1 0-1.4zM13 7h.01",
  customers: "M10 10a3.2 3.2 0 1 0 0-6.4A3.2 3.2 0 0 0 10 10zM3.8 16.5c.8-3 3.3-4.6 6.2-4.6s5.4 1.6 6.2 4.6",
  content: "M5 3h7l3 3v11H5zM12 3v3h3M7.5 10h5M7.5 13h5",
  analytics: "M4 16V9M8.5 16V5M13 16v-5M17 16V7.5M3 16.5h15",
  search: "M8.8 14.6a5.8 5.8 0 1 0 0-11.6 5.8 5.8 0 0 0 0 11.6zM13 13l4 4",
  health: "M3 10h3l2-4 3.5 8 2-4H17",
  store: "M3.5 7.5 5 3.5h10l1.5 4M3.5 7.5h13M3.5 7.5c0 1.2 1 2 2.2 2s2.1-.8 2.1-2c0 1.2 1 2 2.2 2s2.2-.8 2.2-2c0 1.2.9 2 2.1 2s2.2-.8 2.2-2M4.5 9.5V16.5h11V9.5M8.5 16.5v-4h3v4",
  settings:
    "M10 12.6a2.6 2.6 0 1 0 0-5.2 2.6 2.6 0 0 0 0 5.2zM16.2 11.6l1.3 1-1.6 2.8-1.6-.6a6 6 0 0 1-1.7 1l-.3 1.7H9.1l-.3-1.7a6 6 0 0 1-1.7-1l-1.6.6-1.6-2.8 1.3-1a6 6 0 0 1 0-2l-1.3-1 1.6-2.8 1.6.6a6 6 0 0 1 1.7-1l.3-1.7h3.2l.3 1.7a6 6 0 0 1 1.7 1l1.6-.6 1.6 2.8-1.3 1a6 6 0 0 1 0 2z",
  external: "M11 3.5h5.5V9M16.5 3.5 9 11M14 12v4.5H3.5V6H8",
  chevron: "M6 8l4 4 4-4",
  check: "M4.5 10.5 8 14l7.5-8",
  plus: "M10 4v12M4 10h12",
  back: "M12.5 4.5 7 10l5.5 5.5",
  logout: "M8 4H4.5v12H8M12 6.5 15.5 10 12 13.5M15.5 10H8",
};

export function Icon({ name, size = 18 }: { name: keyof typeof P | string; size?: number }) {
  return (
    <svg className="i" viewBox="0 0 20 20" width={size} height={size} aria-hidden="true">
      <path d={P[name] ?? ""} />
    </svg>
  );
}

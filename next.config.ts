import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // Photos produits : Supabase Storage, CDN fournisseurs, etc.
    remotePatterns: [{ protocol: "https", hostname: "**" }],
    formats: ["image/avif", "image/webp"],
  },
  poweredByHeader: false,
};

export default nextConfig;

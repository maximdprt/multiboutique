import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // Photos produits : Supabase Storage, CDN fournisseurs, etc.
    remotePatterns: [{ protocol: "https", hostname: "**" }],
    formats: ["image/avif", "image/webp"],
  },
  poweredByHeader: false,
  // Envoi de photos depuis l'admin (12 photos de 20 Mo au plus par envoi, compressées ensuite)
  experimental: { serverActions: { bodySizeLimit: "50mb" } },
};

export default nextConfig;

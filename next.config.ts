import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // PWA-ready / SEO-first: statische export van event- en saunapagina's via SSG.
  // Sauna-/eventfoto's blijven lokaal; bol.com-productafbeeldingen (gidsen)
  // komen van het s-bol.com CDN en worden hier als remote pattern toegestaan.
  images: {
    remotePatterns: [{ protocol: "https", hostname: "**.s-bol.com" }],
  },
};

export default nextConfig;

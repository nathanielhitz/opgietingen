import type { MetadataRoute } from "next";
import { site } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // Affiliate-redirects, het beheerpaneel en het beheer-dashboard niet crawlen/indexeren.
      disallow: ["/uit/", "/keystatic", "/api/keystatic", "/beheer"],
    },
    sitemap: `${site.url}/sitemap.xml`,
    host: site.url,
  };
}

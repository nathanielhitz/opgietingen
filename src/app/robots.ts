import type { MetadataRoute } from "next";
import { site } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // Affiliate-redirects niet crawlen/indexeren.
      disallow: "/uit/",
    },
    sitemap: `${site.url}/sitemap.xml`,
    host: site.url,
  };
}

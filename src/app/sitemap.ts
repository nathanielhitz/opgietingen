import type { MetadataRoute } from "next";
import { site } from "@/lib/site";
import { getAllEvents, getAllSaunas, getProvincesWithEvents, slugify } from "@/lib/content";
import { monthYearSlug } from "@/lib/dates";

/**
 * Genereert /sitemap.xml. Bevat alle publieke, indexeerbare routes.
 * /uit/* (affiliate-redirects) staat er bewust NIET in.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const u = (p: string) => `${site.url}${p}`;

  const statics: MetadataRoute.Sitemap = [
    { url: u("/"), changeFrequency: "daily", priority: 1 },
    { url: u("/agenda"), changeFrequency: "daily", priority: 0.9 },
    { url: u("/saunas"), changeFrequency: "weekly", priority: 0.7 },
    { url: u("/over"), changeFrequency: "yearly", priority: 0.3 },
    { url: u("/contact"), changeFrequency: "yearly", priority: 0.3 },
    { url: u("/voor-saunas"), changeFrequency: "monthly", priority: 0.4 },
  ];

  const events = getAllEvents().map((e) => ({
    url: u(`/event/${e.slug}`),
    changeFrequency: "weekly" as const,
    priority: 0.8,
  }));

  const saunas = getAllSaunas().map((s) => ({
    url: u(`/sauna/${s.slug}`),
    changeFrequency: "monthly" as const,
    priority: 0.6,
  }));

  const provinces = getProvincesWithEvents().map((p) => ({
    url: u(`/opgietingen/${slugify(p.provincie)}`),
    changeFrequency: "weekly" as const,
    priority: 0.7,
  }));

  const months = [...new Set(getAllEvents().map((e) => monthYearSlug(e.startDatum)))].map((slug) => ({
    url: u(`/agenda/${slug}`),
    changeFrequency: "weekly" as const,
    priority: 0.6,
  }));

  return [...statics, ...events, ...saunas, ...provinces, ...months];
}

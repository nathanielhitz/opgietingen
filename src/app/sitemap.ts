import type { MetadataRoute } from "next";
import { site } from "@/lib/site";
import { getAllEvents, getProvincesWithSaunas, getAllSaunas, getAllGidsen, slugify } from "@/lib/content";
import { isUpcoming, monthYearSlug, todayISO } from "@/lib/dates";

/**
 * Genereert /sitemap.xml. Bevat alle publieke, indexeerbare routes.
 * - /uit/* (affiliate-redirects) staat er bewust NIET in.
 * - Verlopen events en verleden maanden vallen eruit: die pagina's blijven
 *   bestaan (archief/editie-koppeling) maar worden niet actief aangeboden
 *   (SEO-PLAN §9). "Vandaag" is hier bewust build-tijd: de wekelijkse
 *   scraper-commit (en elke deploy) verst het venster.
 * - lastModified alleen waar het klopt: lijst-/agendapagina's veranderen met
 *   elke content-deploy (= build-datum), gidsen hebben `bijgewerkt`. Event- en
 *   saunapagina's krijgen géén lastMod: we kennen hun echte wijzigingsdatum
 *   niet, en een gefingeerde datum ondermijnt het signaal bij Google.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const u = (p: string) => `${site.url}${p}`;
  const vandaag = todayISO();
  const huidigeMaandStart = `${vandaag.slice(0, 7)}-01`;

  const statics: MetadataRoute.Sitemap = [
    { url: u("/"), lastModified: vandaag, changeFrequency: "daily", priority: 1 },
    { url: u("/agenda"), lastModified: vandaag, changeFrequency: "daily", priority: 0.9 },
    { url: u("/opgietingen/vandaag"), lastModified: vandaag, changeFrequency: "daily", priority: 0.8 },
    { url: u("/opgietingen/dit-weekend"), lastModified: vandaag, changeFrequency: "daily", priority: 0.8 },
    { url: u("/wat-is-een-opgieting"), changeFrequency: "monthly", priority: 0.8 },
    { url: u("/opgietweekenden"), lastModified: vandaag, changeFrequency: "weekly", priority: 0.7 },
    { url: u("/aufguss-kampioenschappen"), lastModified: vandaag, changeFrequency: "weekly", priority: 0.7 },
    { url: u("/aufguss-kampioenschappen/wk-2026"), changeFrequency: "weekly", priority: 0.7 },
    { url: u("/saunas"), changeFrequency: "weekly", priority: 0.7 },
    { url: u("/gids"), changeFrequency: "weekly", priority: 0.6 },
    { url: u("/saunahoed"), changeFrequency: "weekly", priority: 0.7 },
    { url: u("/over"), changeFrequency: "yearly", priority: 0.3 },
    { url: u("/contact"), changeFrequency: "yearly", priority: 0.3 },
    { url: u("/voor-saunas"), changeFrequency: "monthly", priority: 0.4 },
    { url: u("/privacybeleid"), changeFrequency: "yearly", priority: 0.2 },
    { url: u("/cookiebeleid"), changeFrequency: "yearly", priority: 0.2 },
  ];

  // Alleen komende events: verlopen event-pagina's blijven live maar
  // verdwijnen uit de sitemap.
  const events = getAllEvents()
    .filter((e) => isUpcoming(e, vandaag))
    .map((e) => ({
      url: u(`/event/${e.slug}`),
      changeFrequency: "weekly" as const,
      priority: 0.8,
    }));

  const saunas = getAllSaunas().map((s) => ({
    url: u(`/sauna/${s.slug}`),
    changeFrequency: "monthly" as const,
    priority: 0.6,
  }));

  // Sauna-gebaseerd: een provinciepagina bestaat zolang er een sauna staat.
  const provinces = getProvincesWithSaunas().map((p) => ({
    url: u(`/opgietingen/${slugify(p.provincie)}`),
    lastModified: vandaag,
    changeFrequency: "weekly" as const,
    priority: 0.7,
  }));

  // Alleen de huidige en toekomstige maanden; verleden maanden zijn archief.
  const months = [
    ...new Set(
      getAllEvents()
        .filter((e) => e.startDatum >= huidigeMaandStart)
        .map((e) => monthYearSlug(e.startDatum)),
    ),
  ].map((slug) => ({
    url: u(`/agenda/${slug}`),
    lastModified: vandaag,
    changeFrequency: "weekly" as const,
    priority: 0.6,
  }));

  const gidsen = getAllGidsen().map((g) => ({
    url: u(`/gids/${g.slug}`),
    ...(g.bijgewerkt ? { lastModified: g.bijgewerkt } : {}),
    changeFrequency: "monthly" as const,
    priority: 0.6,
  }));

  return [...statics, ...events, ...saunas, ...provinces, ...months, ...gidsen];
}

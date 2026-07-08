/**
 * Centrale site-configuratie. Wordt gebruikt voor metadata, SEO en structured data.
 */
export const site = {
  name: "Opgietingen.nl",
  /** Basis-URL voor canonicals, sitemap en OG-images. Zet in productie via env. */
  url: process.env.NEXT_PUBLIC_SITE_URL ?? "https://opgietingen.nl",
  tagline: "Dé agenda voor opgiet-evenementen in Nederland en België",
  description:
    "Ontdek waar en wanneer er opgietingen (Aufguss-sessies), opgietweekenden en thema-events zijn in sauna's in Nederland en België. Filter op provincie, datum en type.",
  locale: "nl_NL",
  twitter: "@opgietingen",
} as const;

export type Country = "NL" | "BE";

/** Event-types conform het datamodel (PRD §4). */
export const EVENT_TYPES = {
  opgietweekend: "Opgietweekend",
  thema: "Thema-event",
  kampioenschap: "Kampioenschap",
  regulier: "Regulier",
} as const;

export type EventType = keyof typeof EVENT_TYPES;

/** Provincies NL + BE, gebruikt voor filters en SEO-regiopagina's. */
export const PROVINCES: Record<Country, string[]> = {
  NL: [
    "Groningen",
    "Friesland",
    "Drenthe",
    "Overijssel",
    "Flevoland",
    "Gelderland",
    "Utrecht",
    "Noord-Holland",
    "Zuid-Holland",
    "Zeeland",
    "Noord-Brabant",
    "Limburg",
  ],
  BE: [
    "Antwerpen",
    "Oost-Vlaanderen",
    "West-Vlaanderen",
    "Vlaams-Brabant",
    "Limburg (BE)",
    "Henegouwen",
    "Luik",
    "Luxemburg",
    "Namen",
    "Waals-Brabant",
    "Brussel",
  ],
};

export const COUNTRY_LABELS: Record<Country, string> = {
  NL: "Nederland",
  BE: "België",
};

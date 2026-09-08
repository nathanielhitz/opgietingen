/**
 * Centrale site-configuratie. Wordt gebruikt voor metadata, SEO en structured data.
 */
export const site = {
  name: "Opgietingen.nl",
  /** Basis-URL voor canonicals, sitemap en OG-images. Zet in productie via env. */
  url: process.env.NEXT_PUBLIC_SITE_URL ?? "https://opgietingen.nl",
  tagline: "Dé agenda voor opgiet-evenementen in Nederland en België",
  description:
    "Ontdek waar en wanneer er opgietingen (Aufguss), opgietweekenden en thema-events zijn in sauna's in Nederland en België. Filter op provincie, datum en type.",
  locale: "nl_NL",
} as const;

/** Eén sociaal kanaal van Opgietingen.nl. */
export interface Social {
  id: "instagram" | "facebook" | "tiktok";
  label: string;
  /** Gebruikersnaam zonder @; ontbreekt zolang Facebook geen gebruikersnaam heeft. */
  handle?: string;
  url: string;
}

/**
 * Sociale kanalen (aangemaakt 2026-09-08). Enige bron voor footer, over-pagina,
 * Organization.sameAs en /links. Facebook linkt op paginanummer tot er een
 * gebruikersnaam geclaimd is; dan alleen hier de URL aanpassen.
 */
export const socials: readonly Social[] = [
  { id: "instagram", label: "Instagram", handle: "opgietingen.nl", url: "https://www.instagram.com/opgietingen.nl/" },
  { id: "facebook", label: "Facebook", url: "https://www.facebook.com/profile.php?id=61594226581273" },
  { id: "tiktok", label: "TikTok", handle: "opgietingen.nl", url: "https://www.tiktok.com/@opgietingen.nl" },
];

export type SocialId = Social["id"];

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

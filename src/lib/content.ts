import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import { cache } from "react";
import type { Country, EventType } from "@/lib/site";

/*
  Repo-based content-loader (fase 1). Leest MDX + frontmatter uit /content en
  joint events aan sauna's. Dit is de ENIGE plek die weet waar content vandaan
  komt — in fase 2 wordt dit vervangen door Postgres/headless CMS zonder dat
  de UI-laag verandert.
*/

const CONTENT_DIR = path.join(process.cwd(), "content");
const SAUNAS_DIR = path.join(CONTENT_DIR, "saunas");
const EVENTS_DIR = path.join(CONTENT_DIR, "events");

export type EventStatus = "concept" | "gepubliceerd" | "afgelopen";

export interface Sauna {
  slug: string;
  naam: string;
  land: Country;
  provincie: string;
  plaats: string;
  adres: string;
  lat: number;
  lng: number;
  faciliteiten: string[];
  website?: string;
  affiliateUrl: string;
  sponsored: boolean;
  afbeelding?: string;
  /** Rauwe MDX-body (beschrijving). */
  body: string;
}

export interface OpgietEvent {
  slug: string;
  saunaSlug: string;
  titel: string;
  type: EventType;
  startDatum: string;
  eindDatum?: string;
  tijden?: string;
  prijsIndicatie?: string;
  ticketUrl?: string;
  afbeelding?: string;
  status: EventStatus;
  /** Rauwe MDX-body (beschrijving/programma). */
  body: string;
  /** Gejoinde sauna. */
  sauna: Sauna;
}

/**
 * YAML parseert kale datums (2026-07-25) als Date-objecten. We willen overal
 * ISO-strings (YYYY-MM-DD). Deze helper normaliseert beide gevallen.
 */
function toISODate(value: unknown): string | undefined {
  if (value == null || value === "") return undefined;
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value);
}

/** Simpele, diacritics-veilige slugify (bv. "Noord-Holland" -> "noord-holland"). */
export function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[()]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function readMdxFiles(dir: string): { slug: string; data: Record<string, unknown>; body: string }[] {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".mdx"))
    .map((file) => {
      const raw = fs.readFileSync(path.join(dir, file), "utf-8");
      const { data, content } = matter(raw);
      return { slug: file.replace(/\.mdx$/, ""), data, body: content.trim() };
    });
}

/* ---------- Sauna's ---------- */

export const getAllSaunas = cache((): Sauna[] => {
  return readMdxFiles(SAUNAS_DIR)
    .map(({ slug, data, body }) => ({
      slug: (data.slug as string) ?? slug,
      naam: data.naam as string,
      land: data.land as Country,
      provincie: data.provincie as string,
      plaats: data.plaats as string,
      adres: data.adres as string,
      lat: Number(data.lat),
      lng: Number(data.lng),
      faciliteiten: (data.faciliteiten as string[]) ?? [],
      website: data.website as string | undefined,
      affiliateUrl: data.affiliateUrl as string,
      sponsored: Boolean(data.sponsored),
      afbeelding: data.afbeelding as string | undefined,
      body,
    }))
    .sort((a, b) => a.naam.localeCompare(b.naam, "nl"));
});

export const getSaunaBySlug = cache((slug: string): Sauna | undefined => {
  return getAllSaunas().find((s) => s.slug === slug);
});

/* ---------- Events ---------- */

/** Alle zichtbare events (niet-concept), gejoind met sauna, gesorteerd op startdatum. */
export const getAllEvents = cache((): OpgietEvent[] => {
  const saunas = new Map(getAllSaunas().map((s) => [s.slug, s]));

  return readMdxFiles(EVENTS_DIR)
    .map(({ slug, data, body }) => {
      const saunaSlug = data.saunaSlug as string;
      const sauna = saunas.get(saunaSlug);
      if (!sauna) {
        // Losse events zonder gekoppelde sauna slaan we over (dataconsistentie).
        return null;
      }
      const event: OpgietEvent = {
        slug: (data.slug as string) ?? slug,
        saunaSlug,
        titel: data.titel as string,
        type: data.type as EventType,
        startDatum: toISODate(data.startDatum) as string,
        eindDatum: toISODate(data.eindDatum),
        tijden: data.tijden as string | undefined,
        prijsIndicatie: data.prijsIndicatie as string | undefined,
        ticketUrl: data.ticketUrl as string | undefined,
        afbeelding: data.afbeelding as string | undefined,
        status: (data.status as EventStatus) ?? "gepubliceerd",
        body,
        sauna,
      };
      return event;
    })
    .filter((e): e is OpgietEvent => e !== null && e.status !== "concept")
    .sort((a, b) => a.startDatum.localeCompare(b.startDatum));
});

export const getEventBySlug = cache((slug: string): OpgietEvent | undefined => {
  return getAllEvents().find((e) => e.slug === slug);
});

/** Events van één sauna (gesorteerd op datum). */
export const getEventsForSauna = cache((saunaSlug: string): OpgietEvent[] => {
  return getAllEvents().filter((e) => e.saunaSlug === saunaSlug);
});

/** Alle unieke provincies waar events voor bestaan, per land. */
export const getProvincesWithEvents = cache((): { land: Country; provincie: string; count: number }[] => {
  const map = new Map<string, { land: Country; provincie: string; count: number }>();
  for (const e of getAllEvents()) {
    const key = `${e.sauna.land}:${e.sauna.provincie}`;
    const existing = map.get(key);
    if (existing) existing.count += 1;
    else map.set(key, { land: e.sauna.land, provincie: e.sauna.provincie, count: 1 });
  }
  return [...map.values()].sort((a, b) => a.provincie.localeCompare(b.provincie, "nl"));
});

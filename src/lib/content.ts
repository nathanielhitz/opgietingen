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
const PROVINCIES_DIR = path.join(CONTENT_DIR, "provincies");
const GIDSEN_DIR = path.join(CONTENT_DIR, "gidsen");

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
 * Een affiliate-product bij een gidsartikel (bv. een saunahoed op bol.com).
 * `bolUrl` mag een gewone bol.com-productlink zijn óf een kant-en-klare
 * partner-deeplink; de redirect (/uit/product/<id>) wikkelt een gewone
 * productlink zo nodig in het partner-clickformat en logt de klik.
 */
export interface GidsProduct {
  id: string;
  naam: string;
  bolUrl: string;
  afbeelding?: string;
  prijsIndicatie?: string;
  beschrijving?: string;
}

/**
 * SEO-gidsartikel (content/gidsen/<slug>.mdx). Draagt informatieve content én
 * optionele affiliate-producten die inline in de MDX-body geplaatst kunnen
 * worden via <Product id="..." /> of <ProductGrid />.
 */
export interface Gids {
  slug: string;
  titel: string;
  samenvatting: string;
  afbeelding?: string;
  bijgewerkt?: string;
  producten: GidsProduct[];
  /** Rauwe MDX-body. */
  body: string;
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
        // Zonder eigen afbeelding (bv. gescrapete events) valt het event terug
        // op de foto van de sauna, zodat kaarten nooit zonder beeld staan.
        afbeelding: (data.afbeelding as string | undefined) ?? sauna.afbeelding,
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

/**
 * Alle unieke provincies waar sauna's staan (met sauna- en eventtelling).
 * SEO-basis voor /opgietingen/[provincie]: een provinciepagina bestaat zolang
 * er een sauna staat — ook als het laatste event verlopen is — zodat de URL
 * (en de opgebouwde ranking) nooit verdwijnt (SEO-PLAN §9).
 */
export const getProvincesWithSaunas = cache(
  (): { land: Country; provincie: string; saunaCount: number; eventCount: number }[] => {
    const map = new Map<string, { land: Country; provincie: string; saunaCount: number; eventCount: number }>();
    for (const s of getAllSaunas()) {
      const key = `${s.land}:${s.provincie}`;
      const existing = map.get(key);
      if (existing) existing.saunaCount += 1;
      else map.set(key, { land: s.land, provincie: s.provincie, saunaCount: 1, eventCount: 0 });
    }
    for (const e of getAllEvents()) {
      const entry = map.get(`${e.sauna.land}:${e.sauna.provincie}`);
      if (entry) entry.eventCount += 1;
    }
    return [...map.values()].sort((a, b) => a.provincie.localeCompare(b.provincie, "nl"));
  },
);

/**
 * Optionele, handgeschreven intro voor een provinciepagina
 * (content/provincies/<provincie-slug>.mdx, alleen de body wordt gebruikt).
 * Bestaat het bestand niet, dan valt de pagina terug op een generieke intro.
 * Zo is het toevoegen van unieke regiocopy (SEO-PLAN fase 3) puur contentwerk.
 */
export const getProvincieIntro = cache((provincieSlug: string): string | undefined => {
  const file = path.join(PROVINCIES_DIR, `${provincieSlug}.mdx`);
  if (!fs.existsSync(file)) return undefined;
  const { content } = matter(fs.readFileSync(file, "utf-8"));
  const body = content.trim();
  return body || undefined;
});

/* ---------- Gidsen ---------- */

function parseProducten(value: unknown): GidsProduct[] {
  if (!Array.isArray(value)) return [];
  const producten: GidsProduct[] = [];
  for (const raw of value) {
    const p = raw as Record<string, unknown>;
    const id = p.id as string | undefined;
    const naam = p.naam as string | undefined;
    const bolUrl = p.bolUrl as string | undefined;
    // Zonder id/naam/link is een product onbruikbaar -> overslaan.
    if (!id || !naam || !bolUrl) continue;
    producten.push({
      id,
      naam,
      bolUrl,
      afbeelding: p.afbeelding as string | undefined,
      prijsIndicatie: p.prijsIndicatie as string | undefined,
      beschrijving: p.beschrijving as string | undefined,
    });
  }
  return producten;
}

/** Alle gidsartikelen, gesorteerd op titel. */
export const getAllGidsen = cache((): Gids[] => {
  return readMdxFiles(GIDSEN_DIR)
    .map(({ slug, data, body }) => ({
      slug: (data.slug as string) ?? slug,
      titel: data.titel as string,
      samenvatting: (data.samenvatting as string) ?? "",
      afbeelding: data.afbeelding as string | undefined,
      bijgewerkt: toISODate(data.bijgewerkt),
      producten: parseProducten(data.producten),
      body,
    }))
    .sort((a, b) => a.titel.localeCompare(b.titel, "nl"));
});

export const getGidsBySlug = cache((slug: string): Gids | undefined => {
  return getAllGidsen().find((g) => g.slug === slug);
});

/**
 * Zoekt een affiliate-product op id over alle gidsen heen (product-ids zijn
 * globaal uniek). Retourneert het product plus de gids-slug, zodat de redirect
 * een subid kan meesturen voor bol-statistieken.
 */
export const getProductById = cache(
  (id: string): { product: GidsProduct; gidsSlug: string } | undefined => {
    for (const gids of getAllGidsen()) {
      const product = gids.producten.find((p) => p.id === id);
      if (product) return { product, gidsSlug: gids.slug };
    }
    return undefined;
  },
);

/**
 * Zoekt voor een (verlopen) event de eerstvolgende nieuwe editie: het eerste
 * komende event bij dezelfde sauna met hetzelfde type. Gebruikt om oude
 * event-pagina's naar de nieuwe editie te laten doorverwijzen zonder redirect
 * (SEO-PLAN §9: editie-koppeling).
 */
export function findNextEdition(event: OpgietEvent, ref: string): OpgietEvent | undefined {
  return getAllEvents().find(
    (e) =>
      e.slug !== event.slug &&
      e.saunaSlug === event.saunaSlug &&
      e.type === event.type &&
      (e.eindDatum ?? e.startDatum) >= ref &&
      e.startDatum > event.startDatum,
  );
}

/**
 * Vergelijkbare komende events voor een event-pagina: eerst zelfde sauna, dan
 * zelfde provincie, dan zelfde type — zonder duplicaten, max `limit`.
 */
export function getRelatedEvents(event: OpgietEvent, ref: string, limit = 3): OpgietEvent[] {
  const upcoming = getAllEvents().filter(
    (e) => e.slug !== event.slug && (e.eindDatum ?? e.startDatum) >= ref,
  );
  const picked: OpgietEvent[] = [];
  const add = (matches: (e: OpgietEvent) => boolean) => {
    for (const e of upcoming) {
      if (picked.length >= limit) return;
      if (!picked.includes(e) && matches(e)) picked.push(e);
    }
  };
  add((e) => e.saunaSlug === event.saunaSlug);
  add((e) => e.sauna.provincie === event.sauna.provincie);
  add((e) => e.type === event.type);
  return picked;
}

import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";

/*
  Content-helpers voor de scraper: bronnen lezen/schrijven, bestaande events
  lezen voor dedup, HTML opschonen, en nieuwe events als MDX wegschrijven.
  Bewust losstaand van src/lib/content.ts (dat React/Next importeert) zodat dit
  als kaal Node-script draait.
*/

const ROOT = process.cwd();
const BRONNEN_PATH = path.join(ROOT, "content", "bronnen.json");
const EVENTS_DIR = path.join(ROOT, "content", "events");
const SAUNAS_DIR = path.join(ROOT, "content", "saunas");

export type BronStatus =
  | "te-verifieren"
  | "actief" // werkende, scrapebare agendapagina gevonden
  | "geen-agenda" // host bereikbaar maar geen aparte agendapagina (evt. JS-gerenderd)
  | "handmatig" // niet-scrapebaar (bv. Facebook/login-wall); handmatige check
  | "aanvullen" // placeholder: bron nog verder in te vullen
  | "opzetten" // toekomstig kanaal (bv. nieuwsbrief-forward), nog op te zetten
  | "kapot"; // host onbereikbaar / URL ongeldig / geblokkeerd

export interface Bron {
  /** Stabiele sleutel; = saunaSlug voor het koppelen van gescrapete events. */
  id: string;
  naam: string;
  land: string; // "NL" | "BE" | "NL/BE"
  provincie?: string;
  website?: string;
  agendaUrl: string;
  /** website | handmatig | nieuwsbrief. Alleen 'website' wordt gescrapet. */
  type?: string;
  /** Helpt op multi-locatie-sites de juiste agendapagina te kiezen. */
  matchToken?: string;
  status: BronStatus;
  notities?: string;
  laatstGecontroleerd?: string | null;
}

interface BronnenFile {
  $schema?: string;
  $comment?: string;
  beschrijving?: string;
  laatstBijgewerkt?: string;
  bronnen: Bron[];
}

export function readBronnen(): BronnenFile {
  return JSON.parse(fs.readFileSync(BRONNEN_PATH, "utf-8")) as BronnenFile;
}

export function writeBronnen(data: BronnenFile): void {
  fs.writeFileSync(BRONNEN_PATH, `${JSON.stringify(data, null, 2)}\n`);
}

/* ---------- Bestaande events (voor dedup) ---------- */

/** YAML parseert kale datums als Date; normaliseer naar ISO YYYY-MM-DD. */
function toISODate(value: unknown): string | undefined {
  if (value == null || value === "") return undefined;
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value);
}

/** Dedup-sleutel conform PRD: saunaId (saunaSlug) + startDatum. */
export function dedupKey(saunaSlug: string, startDatum: string): string {
  return `${saunaSlug}|${startDatum}`;
}

/** Sleutels van alle bestaande events in content/events/. */
export function existingEventKeys(): Set<string> {
  const keys = new Set<string>();
  if (!fs.existsSync(EVENTS_DIR)) return keys;
  for (const file of fs.readdirSync(EVENTS_DIR)) {
    if (!file.endsWith(".mdx")) continue;
    const { data } = matter(fs.readFileSync(path.join(EVENTS_DIR, file), "utf-8"));
    const startDatum = toISODate(data.startDatum);
    if (data.saunaSlug && startDatum) keys.add(dedupKey(String(data.saunaSlug), startDatum));
  }
  return keys;
}

// Slugs van bestaande sauna-profielen (bestandsnaam zonder .mdx).
// Gebruikt door de kwaliteitspoort om saunaSlug-verwijzingen te valideren.
export function existingSaunaSlugs(): Set<string> {
  if (!fs.existsSync(SAUNAS_DIR)) return new Set();
  return new Set(
    fs
      .readdirSync(SAUNAS_DIR)
      .filter((f) => f.endsWith(".mdx"))
      .map((f) => f.replace(/\.mdx$/, "")),
  );
}

/* ---------- Slug + HTML ---------- */

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

/** Ruwe HTML → leesbare tekst; verwijdert scripts/styles en comprimeert witruimte. */
export function htmlToText(html: string, maxChars = 60000): string {
  const text = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<svg[\s\S]*?<\/svg>/gi, " ")
    .replace(/<head[\s\S]*?<\/head>/gi, " ")
    .replace(/<\/(p|div|li|h[1-6]|tr|section|article)>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&euro;/gi, "€")
    .replace(/&[a-z]+;/gi, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return text.length > maxChars ? `${text.slice(0, maxChars)}\n…[ingekort]` : text;
}

/* ---------- Event wegschrijven ---------- */

export interface NewEvent {
  saunaSlug: string;
  titel: string;
  type: "opgietweekend" | "thema" | "kampioenschap" | "regulier";
  startDatum: string;
  eindDatum?: string;
  tijden?: string;
  prijsIndicatie?: string;
  ticketUrl?: string;
  beschrijving: string;
  status: "concept" | "gepubliceerd"; // door de poort bepaald
  keurNotitie?: string; // afkeurreden(en) bij status concept
}

/** Genereert een unieke, leesbare slug voor het event-bestand. */
export function eventSlug(ev: NewEvent): string {
  return `${slugify(ev.titel)}-${ev.startDatum}`.replace(/-+/g, "-");
}

/**
 * Schrijft een event als MDX met status "concept". Retourneert het pad, of
 * null als het bestand al bestaat (geen overschrijving).
 */
export function writeEventMdx(ev: NewEvent): string | null {
  fs.mkdirSync(EVENTS_DIR, { recursive: true });
  const slug = eventSlug(ev);
  const filePath = path.join(EVENTS_DIR, `${slug}.mdx`);
  if (fs.existsSync(filePath)) return null;

  const frontmatter: Record<string, unknown> = {
    slug,
    saunaSlug: ev.saunaSlug,
    titel: ev.titel,
    type: ev.type,
    startDatum: ev.startDatum,
    ...(ev.eindDatum ? { eindDatum: ev.eindDatum } : {}),
    ...(ev.tijden ? { tijden: ev.tijden } : {}),
    ...(ev.prijsIndicatie ? { prijsIndicatie: ev.prijsIndicatie } : {}),
    ...(ev.ticketUrl ? { ticketUrl: ev.ticketUrl } : {}),
    status: ev.status,
    bron: "scraper",
    ...(ev.keurNotitie ? { keurNotitie: ev.keurNotitie } : {}),
  };

  const body = ev.beschrijving?.trim() || `${ev.titel} bij deze sauna.`;
  const file = matter.stringify(`\n${body}\n`, frontmatter);
  fs.writeFileSync(filePath, file);
  return filePath;
}

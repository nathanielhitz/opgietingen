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

/**
 * Koppelt een nieuwsbrief-afzender aan een sauna-bron (→ saunaSlug).
 * Match-volgorde:
 *   1. expliciete `matchToken` die als substring in het afzenderadres zit
 *      (bv. matchToken "@thermenbussloo.nl");
 *   2. host van `website` die overeenkomt met het afzenderdomein (automatisch).
 * Retourneert de gematchte bron, of undefined als geen bron past.
 */
export function matchBronBySender(bronnen: Bron[], fromAddress: string): Bron | undefined {
  const from = fromAddress.toLowerCase().trim();
  if (!from) return undefined;
  const domain = from.split("@")[1] ?? "";

  const byToken = bronnen.find(
    (b) => b.matchToken && from.includes(b.matchToken.toLowerCase()),
  );
  if (byToken) return byToken;

  if (!domain) return undefined;
  return bronnen.find((b) => {
    if (!b.website) return false;
    try {
      const host = new URL(b.website).hostname.replace(/^www\./, "");
      return host && (domain === host || domain.endsWith(`.${host}`));
    } catch {
      return false;
    }
  });
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

// htmlToText is verhuisd naar src/lib/html.ts (gedeeld met de scraper-laag);
// re-export zodat script-side importeurs (mail.ts, verify-bronnen) hier blijven werken.
export { htmlToText } from "../../src/lib/html";

/* ---------- Tekstnormalisatie ---------- */

/**
 * Verwijdert em-streepjes (—) uit vrije proza-tekst (titel, beschrijving).
 * Die lezen als 'AI-achtig'; we vervangen ze context-neutraal maar
 * grammaticaal veilig:
 *   - een ingesloten/aanhangend streepje met spaties (" — ") wordt een komma;
 *   - een streepje zonder spaties (woord—woord) wordt een gewoon koppelteken;
 *   - overtollige spaties vóór komma's en dubbele komma's worden opgeruimd.
 * En-streepjes (–) blijven ongemoeid: die zijn de nette bereikscheiding.
 */
export function normalizeProseDashes(text: string): string {
  return text
    .replace(/\s+—\s+/g, ", ")
    .replace(/—/g, "-")
    .replace(/\s+,/g, ",")
    .replace(/,\s*,/g, ",");
}

/**
 * Voor bereikvelden (tijden, prijsindicatie): een em-streepje is vrijwel altijd
 * een bereikscheiding, dus wordt het het halve streepje zonder spaties dat de
 * rest van de content ook gebruikt (bv. "11:00–18:00").
 */
export function normalizeRangeDashes(text: string): string {
  return text.replace(/\s*—\s*/g, "–");
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
 * Schrijft een event als MDX met de status uit ev.status. Retourneert het pad,
 * of null als het bestand al bestaat (geen overschrijving).
 */
export function writeEventMdx(ev: NewEvent): string | null {
  fs.mkdirSync(EVENTS_DIR, { recursive: true });
  const slug = eventSlug(ev);
  const filePath = path.join(EVENTS_DIR, `${slug}.mdx`);
  if (fs.existsSync(filePath)) return null;

  // Normaliseer em-streepjes weg vóór het wegschrijven: dit is het enige
  // schrijfpunt, dus zo komt er nooit een — in gescrapete content terecht.
  const titel = normalizeProseDashes(ev.titel);

  const frontmatter: Record<string, unknown> = {
    slug,
    saunaSlug: ev.saunaSlug,
    titel,
    type: ev.type,
    startDatum: ev.startDatum,
    ...(ev.eindDatum ? { eindDatum: ev.eindDatum } : {}),
    ...(ev.tijden ? { tijden: normalizeRangeDashes(ev.tijden) } : {}),
    ...(ev.prijsIndicatie ? { prijsIndicatie: normalizeRangeDashes(ev.prijsIndicatie) } : {}),
    ...(ev.ticketUrl ? { ticketUrl: ev.ticketUrl } : {}),
    status: ev.status,
    bron: "scraper",
    ...(ev.keurNotitie ? { keurNotitie: ev.keurNotitie } : {}),
  };

  const body = normalizeProseDashes(ev.beschrijving?.trim() || `${titel} bij deze sauna.`);
  const file = matter.stringify(`\n${body}\n`, frontmatter);
  fs.writeFileSync(filePath, file);
  return filePath;
}

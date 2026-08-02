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
  /**
   * URL van de Facebook-pagina van de sauna. Matching-anker voor doorgestuurde
   * social-posts in scrape-mail (matchBronByContent). Automatisch FB-scrapen is
   * bewust NIET gebouwd (fase B blijft op papier), zie
   * docs/superpowers/specs/2026-08-02-facebook-doorstuurkanaal-design.md.
   */
  facebook?: string;
  agendaUrl: string;
  /** website | handmatig | nieuwsbrief. Alleen 'website' wordt gescrapet. */
  type?: string;
  /** Helpt op multi-locatie-sites de juiste agendapagina te kiezen. */
  matchToken?: string;
  /**
   * true = agendaUrl is handmatig gecureerd: verify-bronnen checkt alleen
   * bereikbaarheid/inhoud en doet geen discovery of herschrijving.
   */
  agendaUrlVast?: boolean;
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

// Gedeelde platform-hosts zijn geen bewijs van afzenderschap: een bron met
// website facebook.com mag niet elke Facebook-notificatiemail claimen.
const PLATFORM_HOSTS = new Set([
  "facebook.com",
  "instagram.com",
  "gmail.com",
  "outlook.com",
  "hotmail.com",
  "mailchimp.com",
]);

/**
 * Koppelt een nieuwsbrief-afzender aan een sauna-bron (→ saunaSlug).
 * Match-volgorde:
 *   1. expliciete `matchToken` die als substring in het afzenderDOMEIN zit —
 *      en alleen als het token op een adres/domein lijkt ("@" of "." bevat):
 *      URL-discovery-tokens zoals "brugge" zouden anders elke mail van
 *      @brugge.be claimen;
 *   2. host van `website` die overeenkomt met het afzenderdomein (automatisch),
 *      behalve platform-hosts, en alleen als precies één bron die host heeft
 *      (bij multi-locatieketens zoals thermae.com is de afzender niet aan één
 *      vestiging toe te wijzen → concept voor handmatige toewijzing).
 * Retourneert de gematchte bron, of undefined als geen bron eenduidig past.
 */
export function matchBronBySender(bronnen: Bron[], fromAddress: string): Bron | undefined {
  const from = fromAddress.toLowerCase().trim();
  if (!from) return undefined;
  const domain = from.split("@")[1] ?? "";

  const byToken = bronnen.find((b) => {
    if (!b.matchToken) return false;
    const token = b.matchToken.toLowerCase();
    if (!token.includes("@") && !token.includes(".")) return false;
    return token.startsWith("@") ? from.includes(token) : domain.includes(token);
  });
  if (byToken) return byToken;

  if (!domain || PLATFORM_HOSTS.has(domain)) return undefined;
  const byHost = bronnen.filter((b) => {
    if (!b.website) return false;
    try {
      const host = new URL(b.website).hostname.replace(/^www\./, "");
      return host !== "" && !PLATFORM_HOSTS.has(host) && (domain === host || domain.endsWith(`.${host}`));
    } catch {
      return false;
    }
  });
  return byHost.length === 1 ? byHost[0] : undefined;
}

// Vaste padsegmenten van Facebook zelf; nooit een paginanaam. Voorkomt dat een
// bron met een pages/-URL of een share-link in een mail een valse match geeft.
const GENERIEKE_FB_SEGMENTEN = new Set([
  "pages",
  "groups",
  "events",
  "people",
  "profile.php",
  "share",
  "story.php",
  "permalink.php",
  "photo.php",
  "watch",
  "reel",
  "hashtag",
  "l.php",
  "login",
  "login.php",
]);

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Domeingrens vóór "facebook": geen letter/cijfer/koppelteken direct ervoor,
// anders zou "myfacebook.com" ook matchen. Een punt ervoor (subdomein, zoals
// "www." of "m.") mag wel, dus die staat niet in de verboden-tekenklasse.
// Zonder /g-vlag hier: match() geeft dan de capture-group mee; met /g zou
// alleen de volledige treffer terugkomen (voor de meervoudige zoekactie in
// matchBronByContent gebruiken we hieronder wél een eigen /g-instantie).
const FACEBOOK_URL_RE = /(?:^|[^a-z0-9-])facebook\.com\/([a-z0-9._-]+)/;

/**
 * Genormaliseerde paginanaam uit een facebook-URL: het eerste padsegment na
 * facebook.com, lowercase. Werkt voor pagina-URLs én post-URLs, en voor
 * www./m.-varianten; een domeingrens voorkomt dat "myfacebook.com" meetelt.
 */
export function facebookPaginanaam(facebookUrl: string | undefined): string | undefined {
  if (!facebookUrl) return undefined;
  const m = facebookUrl.toLowerCase().match(FACEBOOK_URL_RE);
  const naam = m?.[1];
  return naam && !GENERIEKE_FB_SEGMENTEN.has(naam) ? naam : undefined;
}

/**
 * Koppelt een doorgestuurde mail (bv. een Facebook-post van een sauna) op
 * INHOUD aan een bron — voor mails waarvan de afzender de doorstuurder is en
 * dus niets over de sauna zegt. Match-volgorde:
 *   1. facebook-paginanamen in de tekst versus het `facebook`-veld van de
 *      bronnen (post- en pagina-URLs, www./m.-varianten, hoofdletterongevoelig);
 *   2. fallback: het website-domein van precies één bron komt in de tekst voor
 *      (platform-hosts uitgesloten, zelfde reden als bij matchBronBySender).
 * Uniek of niets: bij twee of meer kandidaten wordt niet gegokt (→ concept
 * met keurNotitie voor handmatige toewijzing, het bestaande vangnet).
 */
export function matchBronByContent(bronnen: Bron[], tekst: string): Bron | undefined {
  const text = tekst.toLowerCase();
  if (!text.trim()) return undefined;

  const paginasInTekst = new Set(
    [...text.matchAll(new RegExp(FACEBOOK_URL_RE.source, "g"))]
      .map((m) => m[1])
      .filter((naam) => !GENERIEKE_FB_SEGMENTEN.has(naam)),
  );
  if (paginasInTekst.size) {
    const byFacebook = bronnen.filter((b) => {
      const naam = facebookPaginanaam(b.facebook);
      return naam !== undefined && paginasInTekst.has(naam);
    });
    if (byFacebook.length === 1) return byFacebook[0];
    if (byFacebook.length > 1) return undefined; // ambigu → niet gokken
  }

  const byHost = bronnen.filter((b) => {
    if (!b.website) return false;
    try {
      const host = new URL(b.website).hostname.replace(/^www\./, "");
      if (host === "" || PLATFORM_HOSTS.has(host)) return false;
      // Domeingrens: geen letters/cijfers/koppeltekens direct vóór of ná de
      // host, anders zou "grootthermen.nl" de bron met host "thermen.nl"
      // matchen. Een punt vóór de host (subdomein, bv. "www.thermenbussloo.nl")
      // mag wel. Ná de host verbiedt de lookahead zowel voortzetting van
      // hetzelfde domeinlabel als een vervolg-domeinlabel na een punt
      // (host.tld.evil.tld — een klassiek domeinspoofing-patroon waarbij de
      // echte host als subdomein van een aanvallersdomein wordt misbruikt).
      const grens = new RegExp(`(?:^|[^a-z0-9-])${escapeRegExp(host)}(?![a-z0-9-]|\\.[a-z0-9])`);
      return grens.test(text);
    } catch {
      return false;
    }
  });
  return byHost.length === 1 ? byHost[0] : undefined;
}

/**
 * Staat dit afzenderadres in de kommagescheiden lijst vertrouwde doorstuurders
 * (env MAIL_VERTROUWDE_AFZENDERS)? Vergelijking op het VOLLEDIGE adres,
 * lowercase. Trusted bepaalt alleen of de content-match geprobeerd wordt —
 * nooit de publicatiestatus (een From-header blijft spoofbaar; mail-events
 * blijven altijd concept).
 */
export function isVertrouwdeAfzender(fromAddress: string, lijst: string | undefined): boolean {
  const from = fromAddress.toLowerCase().trim();
  if (!from || !lijst) return false;
  return lijst
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)
    .includes(from);
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
  return new Set(existingEventTitles().keys());
}

/**
 * Dedup-sleutel → titel van het bestaande event. De titel maakt het mogelijk
 * om bij een dedup-hit te melden dat er mógelijk een tweede, ander event op
 * dezelfde dag bestaat (de grove sleutel saunaSlug+startDatum laat bewust maar
 * één event per sauna per dag toe, als anker tegen her-scraping).
 */
export function existingEventTitles(): Map<string, string> {
  const map = new Map<string, string>();
  for (const ev of readEventFrontmatter()) {
    map.set(dedupKey(ev.saunaSlug, ev.startDatum), ev.titel);
  }
  return map;
}

/** Frontmatter van alle events met een bruikbare saunaSlug + startDatum. */
function readEventFrontmatter(): { saunaSlug: string; startDatum: string; titel: string }[] {
  if (!fs.existsSync(EVENTS_DIR)) return [];
  const out: { saunaSlug: string; startDatum: string; titel: string }[] = [];
  for (const file of fs.readdirSync(EVENTS_DIR)) {
    if (!file.endsWith(".mdx")) continue;
    const { data } = matter(fs.readFileSync(path.join(EVENTS_DIR, file), "utf-8"));
    const startDatum = toISODate(data.startDatum);
    if (!data.saunaSlug || !startDatum) continue;
    out.push({
      saunaSlug: String(data.saunaSlug),
      startDatum,
      titel: String(data.titel ?? ""),
    });
  }
  return out;
}

/**
 * Sleutel voor het herkennen van hetzelfde event bij verschillende sauna's:
 * genormaliseerde titel + startdatum, bewust zónder saunaSlug.
 */
export function titelDatumKey(titel: string, startDatum: string): string {
  return `${slugify(titel)}|${startDatum}`;
}

/**
 * titelDatumKey → saunaSlug van het event dat er al ligt. Keten-sauna's
 * kondigen elkaars events aan (de BeWellness Aufguss Challenge-finale stond zo
 * vijf keer live), en de dedup op saunaSlug + startDatum ziet dat niet: elke
 * aankondiger levert een eigen sleutel op. Deze index vangt de kopie op de
 * titel, zodat alleen de eerste vindplaats automatisch gepubliceerd wordt.
 */
export function existingTitelDatumIndex(): Map<string, string> {
  const map = new Map<string, string>();
  for (const ev of readEventFrontmatter()) {
    if (!ev.titel) continue;
    const key = titelDatumKey(ev.titel, ev.startDatum);
    if (!map.has(key)) map.set(key, ev.saunaSlug);
  }
  return map;
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
    // Regel-initiële em-dash is een opsomming: nette markdown-bullet van maken
    // (vóór de generieke vervangingen, die anders regels aan elkaar plakken).
    .replace(/^—[ \t]*/gm, "- ")
    // Alleen horizontale witruimte matchen: \s zou ook newlines opeten en
    // daarmee een opsomming tot één kommaregel verminken.
    .replace(/[ \t]+—[ \t]+/g, ", ")
    .replace(/—/g, "-")
    .replace(/[ \t]+,/g, ",")
    .replace(/,[ \t]*,/g, ",");
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

/**
 * Genereert een unieke, leesbare slug voor het event-bestand. De saunaSlug zit
 * in de naam zodat twee sauna's met dezelfde generieke titel ("Opgietingen")
 * op dezelfde dag niet op bestandsnaam botsen (het tweede event zou dan stil
 * sneuvelen). Als de titel de saunanaam al begint te herhalen, laten we het
 * voorvoegsel weg om dubbele namen als "vitae-goes-vitae-goes-…" te vermijden.
 */
export function eventSlug(ev: NewEvent): string {
  const titelSlug = slugify(ev.titel) || "event";
  const prefix = titelSlug.startsWith(ev.saunaSlug) ? "" : `${ev.saunaSlug}-`;
  return `${prefix}${titelSlug}-${ev.startDatum}`.replace(/-+/g, "-");
}

/**
 * MDX behandelt `<`, `{` en `}` als syntax (JSX/expressies). Gescrapete tekst
 * moet als platte tekst renderen: één "<12 jaar" in een beschrijving zou
 * anders de volledige productie-build breken, en `{…}` zou als JS-expressie
 * worden UITGEVOERD tijdens de build. Backslash-escapes maken er letterlijke
 * tekens van.
 */
export function escapeMdxText(text: string): string {
  return text.replace(/\\/g, "\\\\").replace(/[<{}]/g, (c) => `\\${c}`);
}

/**
 * Schrijft een event als MDX met de status uit ev.status. Retourneert het pad,
 * of null als het bestand al bestaat (geen overschrijving). `dir` overschrijft
 * de doelmap (dry-runs schrijven naar een tijdelijke map zodat mock-events
 * nooit per ongeluk in content/events/ belanden en gecommit worden).
 */
export function writeEventMdx(ev: NewEvent, dir: string = EVENTS_DIR): string | null {
  fs.mkdirSync(dir, { recursive: true });
  const slug = eventSlug(ev);
  const filePath = path.join(dir, `${slug}.mdx`);
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

  const body = escapeMdxText(normalizeProseDashes(ev.beschrijving?.trim() || `${titel} bij deze sauna.`));
  const file = matter.stringify(`\n${body}\n`, frontmatter);
  fs.writeFileSync(filePath, file);
  return filePath;
}

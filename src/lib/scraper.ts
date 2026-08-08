/*
  Scraper-laag voor de event-pipeline — de ENIGE plek die weet hoe een
  agendapagina wordt opgehaald en omgezet naar gestructureerde events.
  Zo is de fetch-/extractielaag vervangbaar zonder de rest van de pipeline
  (dedup, MDX-schrijven, CLI, workflow) te raken.

  Strategie (goedkoopste eerst — Firecrawl-credits zijn de schaarse resource):
    1. Kale fetch van de pagina (gratis). Levert dat substantiële statische
       tekst op, dan extraheert Claude (claude-haiku-4-5) daaruit direct en
       wordt Firecrawl volledig overgeslagen.
    2. Blijkt de pagina een JS-shell (nauwelijks statische tekst) of faalt de
       kale route, dan haalt Firecrawl de pagina op als markdown én doet
       structured extraction met ons event-datamodel als JSON-schema.
    3. Valt die structured extraction tegen (geen/onbruikbare output), dan
       vallen we terug op Claude-extractie op de Firecrawl-markdown.

  Vereist env: ANTHROPIC_API_KEY (goedkope route + fallback-extractie),
               FIRECRAWL_API_KEY (alleen nodig voor JS-gerenderde pagina's).
*/
import Firecrawl from "@mendable/firecrawl-js";
import Anthropic from "@anthropic-ai/sdk";
import { htmlToText } from "./html";

/** Model voor de fallback-extractie (bewust een snel/goedkoop model). */
const FALLBACK_MODEL = "claude-haiku-4-5";

const USER_AGENT =
  "Opgietingen.nl-bot/1.0 (+https://opgietingen.nl/over; agenda voor opgietingen; contact: info@opgietingen.nl)";

export const EVENT_TYPES = ["opgietweekend", "thema", "kampioenschap", "regulier"] as const;
export type EventType = (typeof EVENT_TYPES)[number];

/** Eén geëxtraheerd event, nog niet gekoppeld aan een sauna. */
export interface ScrapedEvent {
  titel: string;
  type: EventType;
  startDatum: string; // YYYY-MM-DD
  eindDatum?: string;
  tijden?: string;
  prijsIndicatie?: string;
  ticketUrl?: string;
  beschrijving: string;
}

export interface ScrapeContext {
  saunaNaam: string;
  land?: "NL" | "BE";
  /**
   * Referentiedatum (ISO YYYY-MM-DD, "vandaag") voor het aanvullen van datums
   * zonder jaartal: het eerstvolgende voorkomen op of ná deze datum. Een kaal
   * referentiejaar was een jaarrond-bug: "10 januari" gescrapet in juli werd
   * 10 januari van dít jaar (verleden) in plaats van volgend jaar.
   */
  vandaag: string;
}

export type ExtractionMethod = "plain-claude" | "firecrawl-json" | "claude-fallback" | "none";

/**
 * Minimale hoeveelheid statische tekst om een pagina als "echt gerenderd" te
 * beschouwen. Daaronder gaan we uit van een JS-shell en is Firecrawl nodig.
 */
export const MIN_STATIC_TEXT_CHARS = 800;

export interface ScrapeOutcome {
  events: ScrapedEvent[];
  markdown: string;
  method: ExtractionMethod;
  warnings: string[];
}

/* ---------- Gedeeld JSON-schema (datamodel PRD §4) ---------- */

const EVENT_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    events: {
      type: "array",
      description:
        "Alle concrete opgiet-/Aufguss-events met een échte datum die op de pagina staan. Laat events zonder concrete datum weg.",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          titel: { type: "string", description: "Naam van het event" },
          type: {
            type: "string",
            enum: [...EVENT_TYPES],
            description:
              "opgietweekend = meerdaags opgietprogramma; thema = thema-avond/-dag; kampioenschap = (voor)wedstrijd; regulier = losse/standaard opgietsessie",
          },
          startDatum: { type: "string", description: "Startdatum in formaat YYYY-MM-DD" },
          eindDatum: { type: "string", description: "Einddatum YYYY-MM-DD, of lege string bij één dag" },
          tijden: { type: "string", description: "Tijden/programma, bv. '19:00 – 23:00'" },
          prijsIndicatie: { type: "string", description: "Prijsindicatie of lege string" },
          ticketUrl: { type: "string", description: "Directe ticket-/info-URL of lege string" },
          beschrijving: {
            type: "string",
            description:
              "Beschrijving van 60-120 woorden op basis van de paginatekst: wat het event inhoudt, wat de bezoeker kan verwachten en voor wie het is. Alleen feiten die op de pagina staan; niets verzinnen.",
          },
        },
        required: ["titel", "type", "startDatum", "beschrijving"],
      },
    },
  },
  required: ["events"],
};

function extractionPrompt(ctx: ScrapeContext): string {
  return [
    `Je haalt opgiet-/Aufguss-events op voor de agenda van ${ctx.saunaNaam}. Vandaag is ${ctx.vandaag}.`,
    `Extraheer ALLEEN echte events met een concrete kalenderdatum. Sla algemene info, arrangementen en losse pagina's zonder datum over.`,
    `Vaste week- of dagroosters ("dagelijks om 11:30", "elke zondag", "ma t/m vr") zijn GEEN events: sla ze over en leid er geen datums uit af.`,
    `Vermeldt een datum geen jaartal, kies dan het jaar waarin die datum het dichtst bij vandaag ligt. Voor een aangekondigd komend event is dat het eerstvolgende voorkomen op of na vandaag (rond de jaarwisseling dus het volgende jaar). Maar lijkt de datum kort geleden verstreken, of is het event nu bezig, gebruik dan dat recente jaar — ook als de datum daarmee in het verleden ligt. Tel er nooit een jaar bij op om een datum toekomstig te maken: verlopen events worden verderop automatisch afgevoerd, een verzonnen datum niet.`,
    `Numerieke datums op de pagina staan altijd in Europese notatie, dag vóór maand — ook zonder jaartal en ook met streepjes: "05/10/2026" is 5 oktober (niet 10 mei) en "09-11" is 9 november (niet 11 september). Zet zo'n datum daarna pas om naar het ISO-formaat YYYY-MM-DD, waarin de maand juist vóór de dag staat. De paginatekst kan Nederlands of Frans zijn; vertaal maandnamen naar de juiste maand.`,
    `Bepaal het type: opgietweekend, thema, kampioenschap of regulier.`,
    `Schrijf per event een beschrijving van 60-120 woorden in vloeiend Nederlands op basis van wat de pagina vermeldt: wat het event inhoudt, wat de bezoeker kan verwachten en voor wie het leuk is. Gebruik uitsluitend feiten van de pagina; verzin geen tijden, prijzen, geuren of programmaonderdelen. Staat er weinig op de pagina, houd de beschrijving dan korter in plaats van te speculeren.`,
  ].join(" ");
}

/* ---------- Lazy clients ---------- */

let firecrawlClient: Firecrawl | null = null;
function getFirecrawl(): Firecrawl {
  if (!process.env.FIRECRAWL_API_KEY) {
    throw new Error("FIRECRAWL_API_KEY ontbreekt — vereist voor de scraper.");
  }
  firecrawlClient ??= new Firecrawl({ apiKey: process.env.FIRECRAWL_API_KEY });
  return firecrawlClient;
}

let anthropicClient: Anthropic | null = null;
function getAnthropic(): Anthropic {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY ontbreekt — vereist voor de fallback-extractie.");
  }
  anthropicClient ??= new Anthropic();
  return anthropicClient;
}

/* ---------- Validatie ---------- */

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Filtert en normaliseert ruwe extractie-output tot geldige ScrapedEvents. */
export function sanitizeEvents(raw: unknown): ScrapedEvent[] {
  const list = (raw as { events?: unknown[] })?.events;
  if (!Array.isArray(list)) return [];

  const out: ScrapedEvent[] = [];
  for (const item of list) {
    const e = item as Record<string, unknown>;
    const titel = typeof e.titel === "string" ? e.titel.trim() : "";
    const startDatum = typeof e.startDatum === "string" ? e.startDatum.trim() : "";
    const type = e.type as EventType;
    if (!titel || !ISO_DATE.test(startDatum) || !EVENT_TYPES.includes(type)) continue;

    const rawEind = typeof e.eindDatum === "string" && ISO_DATE.test(e.eindDatum.trim())
      ? e.eindDatum.trim()
      : undefined;
    // Een (gehallucineerde) einddatum vóór de startdatum zou het event via
    // isUpcoming direct van de site laten verdwijnen → droppen.
    const eindDatum = rawEind && rawEind >= startDatum ? rawEind : undefined;
    const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : undefined);
    // ticketUrl gaat ongefilterd een 302-redirect in (/uit/[slug]); alleen
    // absolute http(s)-URL's toestaan — een relatief of verzonnen pad zou een
    // 500 of open redirect opleveren. De aanroeper valt terug op de bron-URL.
    const ticketUrl = (() => {
      const v = str(e.ticketUrl);
      if (!v) return undefined;
      try {
        const u = new URL(v);
        return u.protocol === "http:" || u.protocol === "https:" ? u.toString() : undefined;
      } catch {
        return undefined;
      }
    })();

    out.push({
      titel,
      type,
      startDatum,
      eindDatum,
      tijden: str(e.tijden),
      prijsIndicatie: str(e.prijsIndicatie),
      ticketUrl,
      beschrijving: str(e.beschrijving) ?? titel,
    });
  }
  return out;
}

/* ---------- Kale fetch (gratis route) ---------- */

/**
 * Haalt een pagina op met een gewone fetch en geeft de leesbare tekst terug,
 * of null bij een fout/lege respons. Robots-naleving is de verantwoordelijkheid
 * van de aanroeper (scrape-events checkt vooraf via isAllowed).
 */
async function plainFetchText(url: string): Promise<string | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20000);
  try {
    const res = await fetch(url, {
      redirect: "follow",
      signal: controller.signal,
      headers: {
        "User-Agent": USER_AGENT,
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "nl,nl-NL;q=0.9,en;q=0.8",
      },
    });
    if (!res.ok) return null;
    const text = htmlToText(await res.text());
    return text || null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/* ---------- Firecrawl: markdown + structured extraction ---------- */

async function firecrawlScrape(
  url: string,
  ctx: ScrapeContext
): Promise<{ markdown: string; events: ScrapedEvent[] }> {
  const doc = await getFirecrawl().scrape(url, {
    formats: [
      "markdown",
      { type: "json", schema: EVENT_JSON_SCHEMA as Record<string, unknown>, prompt: extractionPrompt(ctx) },
    ],
    onlyMainContent: true,
    headers: { "User-Agent": USER_AGENT },
    timeout: 60000,
  });

  return {
    markdown: doc.markdown ?? "",
    events: sanitizeEvents(doc.json),
  };
}

// Haalt een pagina op als markdown via Firecrawl (echte browser-rendering),
// zonder structured extraction. Voor verify-bronnen's JS-fallback (spec §4).
// Retourneert null als er geen key is of de fetch niets bruikbaars oplevert.
export async function firecrawlFetchMarkdown(url: string): Promise<string | null> {
  if (!process.env.FIRECRAWL_API_KEY) return null;
  try {
    const doc = await getFirecrawl().scrape(url, {
      formats: ["markdown"],
      onlyMainContent: true,
      headers: { "User-Agent": USER_AGENT },
      timeout: 60000,
    });
    const markdown = doc.markdown ?? "";
    return markdown.trim() ? markdown : null;
  } catch {
    return null;
  }
}

/* ---------- Claude-fallback (claude-haiku-4-5) ---------- */

/** Cap op de invoertekst (zelfde grens als htmlToText hanteert). */
const MAX_EXTRACT_INPUT_CHARS = 60000;

async function claudeExtract(markdown: string, ctx: ScrapeContext): Promise<ScrapedEvent[]> {
  if (!markdown.trim()) return [];

  // Streamen omdat de SDK een non-streaming request boven deze grens weigert
  // (risico op HTTP-timeout) — niet omdat we de tokens live willen zien.
  // Gemeten: 60 events mét volledige beschrijvingen kosten ~10K output-tokens,
  // dus het oude plafond van 16K kapte pas rond de 95 events af. Zeldzaam,
  // maar het faalt dan hard (zie de max_tokens-check in eventsFromMessage) en
  // juist bij de bronnen met de meeste events. 32K geeft ruimte voor ~190
  // events; er wordt alleen betaald wat werkelijk gegenereerd wordt, dus de
  // limiet begrenst hier vooral een op hol geslagen run.
  const stream = getAnthropic().messages.stream({
    model: FALLBACK_MODEL,
    max_tokens: 32768,
    system:
      "Je bent een nauwkeurige extractie-assistent voor een sauna-opgietagenda. " +
      "Je roept altijd de tool record_events aan met alle gevonden events. Verzin niets.",
    tools: [
      {
        name: "record_events",
        description: extractionPrompt(ctx),
        // Met strict kan het model niet buiten het schema kleuren. Zonder dit
        // belandt een net-verkeerde enum-waarde ("Thema") in sanitizeEvents,
        // die het event dan geruisloos weggooit — een gemist event zonder spoor.
        // De API verwerkt dit veld (een schema met additionalProperties: true
        // wordt alléén mét strict geweigerd), maar de typings van SDK 0.70
        // kennen het nog niet. Zodra de SDK bijwerkt, meldt TypeScript deze
        // directive als overbodig — dat is het sein om hem te verwijderen.
        // @ts-expect-error strict bestaat nog niet op Tool in @anthropic-ai/sdk 0.70
        strict: true,
        input_schema: EVENT_JSON_SCHEMA as Anthropic.Tool.InputSchema,
      },
    ],
    tool_choice: { type: "tool", name: "record_events" },
    messages: [
      {
        role: "user",
        content: `Sauna: ${ctx.saunaNaam}\nVandaag: ${ctx.vandaag}\n\nPAGINA (markdown):\n\n${markdown.slice(0, MAX_EXTRACT_INPUT_CHARS)}`,
      },
    ],
  });

  return eventsFromMessage(await stream.finalMessage());
}

/**
 * Haalt de events uit een Claude-antwoord. Gooit wanneer het antwoord geen
 * bruikbare tool-aanroep bevat, zodat de aanroeper een mislukte extractie als
 * warning ziet in plaats van als lege agenda. Apart van claudeExtract omdat de
 * regels hieronder puur zijn en zonder API-key getest kunnen worden.
 */
export function eventsFromMessage(
  message: Pick<Anthropic.Message, "content" | "stop_reason">,
): ScrapedEvent[] {
  // Afgekapte tool-input zou stil dataverlies zijn (sanitizeEvents maakt er
  // geruisloos minder/0 events van); hard falen zodat de aanroeper het als
  // warning ziet en eventueel de Firecrawl-route probeert.
  if (message.stop_reason === "max_tokens") {
    throw new Error("extractie afgekapt (max_tokens bereikt) — resultaat onbetrouwbaar");
  }
  // Onder streaming bouwt de SDK tool_use.input incrementeel op met een
  // tolerante JSON-parser en valideert bij het afsluiten niet opnieuw. Alleen
  // een normaal afgesloten antwoord levert dus gegarandeerd een volledig
  // object op; bij elke andere stopreden kan er een half geparseerde input
  // staan die sanitizeEvents stilzwijgend zou uitdunnen tot minder events.
  if (message.stop_reason !== "tool_use" && message.stop_reason !== "end_turn") {
    throw new Error(`extractie onvolledig afgesloten (stop_reason: ${message.stop_reason})`);
  }

  const toolUse = message.content.find(
    (b): b is Anthropic.ToolUseBlock => b.type === "tool_use" && b.name === "record_events"
  );
  // Zonder tool-aanroep is er niets geëxtraheerd — ook wanneer het model de
  // opdracht weigert (stop_reason "refusal", mogelijk ondanks de geforceerde
  // tool_choice). Stil [] teruggeven is niet te onderscheiden van een lege
  // agenda: de bron zou dan elke run geruisloos zijn events verliezen.
  if (!toolUse) {
    throw new Error(`geen tool_use-blok in het antwoord (stop_reason: ${message.stop_reason})`);
  }
  return sanitizeEvents(toolUse.input);
}

/* ---------- Orkestratie ---------- */

/**
 * Extraheert events uit reeds opgehaalde tekst/markdown (bv. een nieuwsbrief-mail)
 * via de Claude-extractie — zonder fetch-stap. De e-mailbron levert de inhoud al
 * aan, dus Firecrawl is hier niet van toepassing. Gebruikt dezelfde ScrapedEvent-
 * output als scrapeAgenda, zodat de rest van de pipeline identiek blijft.
 */
export async function extractEventsFromText(
  markdown: string,
  ctx: ScrapeContext
): Promise<ScrapeOutcome> {
  const warnings: string[] = [];
  if (!markdown.trim()) {
    return { events: [], markdown, method: "none", warnings: ["Lege inhoud; niets te extraheren."] };
  }
  try {
    const events = await claudeExtract(markdown, ctx);
    // Ook 0 events is een geslaagde extractie; "none" is voorbehouden aan falen.
    return { events, markdown, method: "claude-fallback", warnings };
  } catch (err) {
    warnings.push(`Claude-extractie-fout: ${err instanceof Error ? err.message : String(err)}`);
    return { events: [], markdown, method: "none", warnings };
  }
}

/**
 * Signalen dat statische tekst echt agenda-inhoud bevat (datums, tijden of
 * opgiet-termen). Zonder deze signalen vertrouwen we een 0-event-resultaat op
 * de kale route niet blind: een cookiebanner + navigatie haalt makkelijk de
 * tekendrempel terwijl de echte agenda JS-gerenderd is.
 */
const AGENDA_SIGNAAL =
  /\d{1,2}:\d{2}|\d{1,2}[-/]\d{1,2}[-/]\d{2,4}|januari|februari|maart|april|\bmei\b|juni|juli|augustus|september|oktober|november|december|opgiet|aufguss/i;

/**
 * Haalt één agendapagina op en levert gestructureerde events.
 * Goedkoopste route eerst: kale fetch + Claude (haiku). Alleen wanneer de
 * pagina een JS-shell blijkt (te weinig statische tekst) of de kale route
 * faalt, wordt Firecrawl gebruikt (structured extraction, met Claude-fallback).
 */
export async function scrapeAgenda(url: string, ctx: ScrapeContext): Promise<ScrapeOutcome> {
  const warnings: string[] = [];

  // Route 1 — kale fetch (gratis) + Claude-extractie op de statische tekst.
  const staticText = await plainFetchText(url);
  if (staticText && staticText.length >= MIN_STATIC_TEXT_CHARS) {
    try {
      const events = await claudeExtract(staticText, ctx);
      // Substantiële statische pagina → vertrouw dit resultaat, ook bij 0
      // events (liever een false negative dan onnodig Firecrawl-credits) —
      // tenzij de tekst geen enkel agenda-signaal bevat: dan is het
      // vermoedelijk boilerplate rond een JS-gerenderde agenda.
      if (events.length > 0 || AGENDA_SIGNAAL.test(staticText)) {
        return { events, markdown: staticText, method: "plain-claude", warnings };
      }
      warnings.push(
        "Kale route gaf 0 events en de statische tekst bevat geen agenda-signalen (datums/tijden/opgiet) — door naar Firecrawl.",
      );
    } catch (err) {
      warnings.push(
        `Kale route mislukt (${err instanceof Error ? err.message : String(err)}); door naar Firecrawl.`,
      );
    }
  } else {
    warnings.push(
      staticText
        ? `Te weinig statische tekst (${staticText.length} tekens) — vermoedelijk JS-gerenderd; Firecrawl nodig.`
        : "Kale fetch mislukt; Firecrawl nodig.",
    );
  }

  // Route 2 — Firecrawl (browser-rendering + structured extraction).
  let markdown = "";
  let firecrawlEvents: ScrapedEvent[] = [];
  try {
    const res = await firecrawlScrape(url, ctx);
    markdown = res.markdown;
    firecrawlEvents = res.events;
  } catch (err) {
    warnings.push(`Firecrawl-fout: ${err instanceof Error ? err.message : String(err)}`);
  }

  if (firecrawlEvents.length > 0) {
    return { events: firecrawlEvents, markdown, method: "firecrawl-json", warnings };
  }

  // Firecrawl-extractie viel tegen → fallback op Claude, mits we markdown hebben.
  if (markdown.trim()) {
    try {
      // Ook 0 events is een geslaagde extractie (gewoon een lege agenda);
      // "none" blijft voorbehouden aan echt falen, zodat scrape-events geen
      // vals "extractie faalde" in het weekissue zet.
      const events = await claudeExtract(markdown, ctx);
      return { events, markdown, method: "claude-fallback", warnings };
    } catch (err) {
      warnings.push(`Claude-fallback-fout: ${err instanceof Error ? err.message : String(err)}`);
    }
  } else {
    warnings.push("Geen markdown ontvangen; fallback overgeslagen.");
  }

  return { events: [], markdown, method: "none", warnings };
}

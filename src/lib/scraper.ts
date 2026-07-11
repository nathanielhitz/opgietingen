/*
  Scraper-laag voor de event-pipeline — de ENIGE plek die weet hoe een
  agendapagina wordt opgehaald en omgezet naar gestructureerde events.
  Zo is de fetch-/extractielaag vervangbaar zonder de rest van de pipeline
  (dedup, MDX-schrijven, CLI, workflow) te raken.

  Strategie:
    1. Firecrawl haalt de pagina op als markdown én doet structured extraction
       met ons event-datamodel als JSON-schema.
    2. Valt die structured extraction tegen (geen/onbruikbare output), dan
       vallen we terug op eigen extractie via de Claude API (claude-haiku-4-5)
       op basis van dezelfde markdown.

  Vereist env: FIRECRAWL_API_KEY (fetch + primaire extractie),
               ANTHROPIC_API_KEY (fallback-extractie).
*/
import Firecrawl from "@mendable/firecrawl-js";
import Anthropic from "@anthropic-ai/sdk";

/** Model voor de fallback-extractie (bewust een snel/goedkoop model). */
const FALLBACK_MODEL = "claude-haiku-4-5";

const USER_AGENT =
  "Opgietingen.nl-bot/1.0 (+https://opgietingen.nl/over; agenda voor opgietingen; contact: hallo@opgietingen.nl)";

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
  /** Referentiejaar voor het aanvullen van datums zonder jaartal. */
  jaar: number;
}

export type ExtractionMethod = "firecrawl-json" | "claude-fallback" | "none";

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
          beschrijving: { type: "string", description: "Korte beschrijving (1-3 zinnen)" },
        },
        required: ["titel", "type", "startDatum", "beschrijving"],
      },
    },
  },
  required: ["events"],
};

function extractionPrompt(ctx: ScrapeContext): string {
  return [
    `Je haalt opgiet-/Aufguss-events op voor de agenda van ${ctx.saunaNaam}.`,
    `Extraheer ALLEEN echte events met een concrete datum. Sla algemene info, arrangementen en losse pagina's zonder datum over.`,
    `Gebruik ${ctx.jaar} als jaartal wanneer een datum geen jaar vermeldt (kies het eerstvolgende voorkomen).`,
    `Datums in formaat YYYY-MM-DD. Vertaal maanden vanuit het Nederlands.`,
    `Bepaal het type: opgietweekend, thema, kampioenschap of regulier.`,
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

    const eindDatum = typeof e.eindDatum === "string" && ISO_DATE.test(e.eindDatum.trim())
      ? e.eindDatum.trim()
      : undefined;
    const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : undefined);

    out.push({
      titel,
      type,
      startDatum,
      eindDatum,
      tijden: str(e.tijden),
      prijsIndicatie: str(e.prijsIndicatie),
      ticketUrl: str(e.ticketUrl),
      beschrijving: str(e.beschrijving) ?? titel,
    });
  }
  return out;
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

async function claudeExtract(markdown: string, ctx: ScrapeContext): Promise<ScrapedEvent[]> {
  if (!markdown.trim()) return [];

  const message = await getAnthropic().messages.create({
    model: FALLBACK_MODEL,
    max_tokens: 4096,
    system:
      "Je bent een nauwkeurige extractie-assistent voor een sauna-opgietagenda. " +
      "Je roept altijd de tool record_events aan met alle gevonden events. Verzin niets.",
    tools: [
      {
        name: "record_events",
        description: extractionPrompt(ctx),
        input_schema: EVENT_JSON_SCHEMA as Anthropic.Tool.InputSchema,
      },
    ],
    tool_choice: { type: "tool", name: "record_events" },
    messages: [
      {
        role: "user",
        content: `Sauna: ${ctx.saunaNaam}\nReferentiejaar: ${ctx.jaar}\n\nPAGINA (markdown):\n\n${markdown}`,
      },
    ],
  });

  const toolUse = message.content.find(
    (b): b is Anthropic.ToolUseBlock => b.type === "tool_use" && b.name === "record_events"
  );
  return toolUse ? sanitizeEvents(toolUse.input) : [];
}

/* ---------- Orkestratie ---------- */

/**
 * Haalt één agendapagina op en levert gestructureerde events.
 * Primair via Firecrawl structured extraction; valt terug op Claude (haiku)
 * wanneer Firecrawl geen bruikbare events oplevert.
 */
export async function scrapeAgenda(url: string, ctx: ScrapeContext): Promise<ScrapeOutcome> {
  const warnings: string[] = [];

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
      const events = await claudeExtract(markdown, ctx);
      if (events.length > 0) {
        return { events, markdown, method: "claude-fallback", warnings };
      }
    } catch (err) {
      warnings.push(`Claude-fallback-fout: ${err instanceof Error ? err.message : String(err)}`);
    }
  } else {
    warnings.push("Geen markdown ontvangen; fallback overgeslagen.");
  }

  return { events: [], markdown, method: "none", warnings };
}

// Kwaliteitspoort voor gescrapete events (spec §1). Pure functie zonder I/O:
// beoordeelt een geëxtraheerd event op harde criteria. Bij twijfel afkeuren —
// false negatives (te streng) zijn acceptabel, false positives (rommel live) niet.

// Geldige event-types (spiegelt EVENT_TYPES in src/lib/site.ts / src/lib/scraper.ts).
const GELDIGE_TYPES = new Set(["opgietweekend", "thema", "kampioenschap", "regulier"]);

// Herkent opgiet-gerelateerde content; voorkomt dat een "moederdagbrunch" doorglipt.
export const OPGIET_RE = /opgiet|aufguss|löyly|loyly|saunaritueel|gietceremonie/i;

export interface GateInput {
  saunaSlug: string;
  titel: string;
  type: string;
  startDatum: string;
  beschrijving?: string;
}

export interface GateContext {
  saunaSlugs: Set<string>; // bestaande profielen in content/saunas/
  today: string; // ISO YYYY-MM-DD, referentiedatum van de run
}

export interface GateResult {
  passed: boolean;
  redenen: string[]; // leeg wanneer passed === true
}

// True als s een echt bestaande kalenderdatum in ISO-formaat is.
export function isRealIsoDate(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

export function evaluateEvent(ev: GateInput, ctx: GateContext): GateResult {
  const redenen: string[] = [];

  if (!isRealIsoDate(ev.startDatum)) {
    redenen.push(`ongeldige datum: "${ev.startDatum}" is geen geldige YYYY-MM-DD`);
  } else if (ev.startDatum < ctx.today) {
    redenen.push(`datum in het verleden: ${ev.startDatum} < ${ctx.today}`);
  }

  if (!ctx.saunaSlugs.has(ev.saunaSlug)) {
    redenen.push(`onbekende saunaSlug: "${ev.saunaSlug}" heeft geen profiel in content/saunas/`);
  }

  if (!ev.titel || !ev.titel.trim()) {
    redenen.push("lege titel");
  }

  if (!GELDIGE_TYPES.has(ev.type)) {
    redenen.push(`ongeldig type: "${ev.type}"`);
  }

  const haystack = `${ev.titel} ${ev.beschrijving ?? ""}`;
  if (!OPGIET_RE.test(haystack)) {
    redenen.push("niet herkenbaar opgiet-gerelateerd (geen trefwoord in titel/beschrijving)");
  }

  return { passed: redenen.length === 0, redenen };
}

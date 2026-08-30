// scripts/lib/metrics.ts
import fs from "node:fs";
import path from "node:path";
import type { BronResultaat, BronStatusWijziging, Kanaal, Methode, RunEvent } from "../../src/lib/scrape-runs";
import type { ExtractionMethod } from "../../src/lib/scraper";

/*
  Run-metrics tijdens de wekelijkse scrape. Elk script (verify-bronnen, de drie
  scrapers) meldt hier wat het deed; alles wordt geappend aan scrape-metrics.json
  (gitignored), dat `npm run run-record` na de run tot één record vouwt.

  Harde regel: niets hier mag ooit gooien. Een metrics-fout logt een waarschuwing
  en laat de scrape gewoon doorgaan — de metrics zijn bijzaak, de events niet.
*/

export interface MetricsBestand {
  verify?: { gecontroleerd: number };
  bronStatusWijzigingen: BronStatusWijziging[];
  bronResultaten: (BronResultaat & { kanaal: Kanaal })[];
  events: RunEvent[];
  mail?: { mails: number; onbekendeAfzenders: number };
}

/** Pad per aanroep bepaald (niet als module-constante) zodat tests in een tijdelijke cwd werken. */
export const METRICS_BESTAND = () => path.join(process.cwd(), "scrape-metrics.json");

function leeg(): MetricsBestand {
  return { bronStatusWijzigingen: [], bronResultaten: [], events: [] };
}

export function legeTeller(id: string): BronResultaat {
  return { id, kandidaten: 0, dedup: 0, afgewezen: 0, verleden: 0, afgekeurd: 0, concept: 0, gepubliceerd: 0, fout: null, methode: "geen" };
}

export function naarMethode(m: ExtractionMethod): Methode {
  switch (m) {
    case "plain-claude": return "statisch";
    case "firecrawl-json": return "firecrawl";
    case "claude-fallback": return "claude";
    default: return "geen";
  }
}

/** Valt terug op een lege array wanneer de JSON geldig maar vormloos is. */
const arr = <T,>(x: unknown): T[] => (Array.isArray(x) ? (x as T[]) : []);

/** Leest het tijdelijke bestand; ontbreekt het of is het onleesbaar → null. */
export function leesMetrics(): MetricsBestand | null {
  try {
    const p = METRICS_BESTAND();
    if (!fs.existsSync(p)) return null;
    const d = JSON.parse(fs.readFileSync(p, "utf8")) as Partial<MetricsBestand>;
    return {
      ...leeg(),
      ...d,
      bronStatusWijzigingen: arr<BronStatusWijziging>(d.bronStatusWijzigingen),
      bronResultaten: arr<BronResultaat & { kanaal: Kanaal }>(d.bronResultaten),
      events: arr<RunEvent>(d.events),
    };
  } catch {
    return null;
  }
}

/** Onderscheidt "geen bestand" van "onleesbaar" — `leesMetrics` geeft voor beide `null` terug. */
export function metricsBestandStatus(): "geen" | "onleesbaar" | "ok" {
  const p = METRICS_BESTAND();
  if (!fs.existsSync(p)) return "geen";
  try {
    JSON.parse(fs.readFileSync(p, "utf8"));
    return "ok";
  } catch {
    return "onleesbaar";
  }
}

function muteer(wijzig: (d: MetricsBestand) => void): void {
  try {
    const p = METRICS_BESTAND();
    let data = leeg();
    if (fs.existsSync(p)) {
      const bestaand = leesMetrics();
      if (bestaand) data = bestaand;
      else console.warn("scrape-metrics.json was onleesbaar (geen geldige JSON) — wordt overschreven.");
    }
    wijzig(data);
    fs.writeFileSync(p, JSON.stringify(data, null, 2) + "\n");
  } catch (err) {
    console.warn(`metrics niet weggeschreven: ${err instanceof Error ? err.message : String(err)}`);
  }
}

export interface Metrics {
  verify(v: { gecontroleerd: number }): void;
  bronStatus(w: BronStatusWijziging): void;
  bron(kanaal: Kanaal, r: BronResultaat): void;
  event(e: RunEvent): void;
  mail(m: { mails: number; onbekendeAfzenders: number }): void;
}

/** `actief: false` (dry-run) → alle methodes zijn no-ops. */
export function maakMetrics(opts: { actief: boolean }): Metrics {
  if (!opts.actief) {
    const noop = () => {};
    return { verify: noop, bronStatus: noop, bron: noop, event: noop, mail: noop };
  }
  return {
    verify: (v) => muteer((d) => { d.verify = v; }),
    bronStatus: (w) => muteer((d) => { d.bronStatusWijzigingen.push(w); }),
    bron: (kanaal, r) => muteer((d) => { d.bronResultaten.push({ ...r, kanaal }); }),
    event: (e) => muteer((d) => { d.events.push(e); }),
    mail: (m) => muteer((d) => { d.mail = m; }),
  };
}

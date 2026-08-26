import fs from "node:fs";
import path from "node:path";

export interface ScrapeWarning {
  bron: string;
  melding: string;
}

/**
 * Voegt warnings toe aan scrape-warnings.json in plaats van het te
 * overschrijven: meerdere scrape-scripts (events, facebook) draaien na elkaar
 * in dezelfde workflow-run en schrijven naar hetzelfde bestand, dat
 * scrape-report.ts als één geheel leest. Bestaat het bestand nog niet (eerste
 * script in de run) dan wordt het aangemaakt. Pad wordt per aanroep bepaald
 * (niet als module-constante) zodat dit ook binnen een tijdelijke testmap werkt.
 */
export function appendScrapeWarnings(run: string, nieuw: ScrapeWarning[]): void {
  const bestandspad = path.join(process.cwd(), "scrape-warnings.json");
  let bestaand: ScrapeWarning[] = [];
  if (fs.existsSync(bestandspad)) {
    try {
      const data = JSON.parse(fs.readFileSync(bestandspad, "utf-8")) as { warnings?: ScrapeWarning[] };
      bestaand = data.warnings ?? [];
    } catch {
      bestaand = [];
    }
  }
  fs.writeFileSync(
    bestandspad,
    JSON.stringify({ run, warnings: [...bestaand, ...nieuw] }, null, 2) + "\n",
  );
}

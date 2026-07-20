import fs from "node:fs";
import path from "node:path";

/*
  Affiliate klik-logging — fase 1 (PRD §5): simpel naar console + bestand.
  Op Vercel is de filesystem read-only (behalve /tmp), dus console.log is de
  betrouwbare bron; de bestands-append is best-effort voor lokale runs.
  Migratiepad: naar een echte analytics-/events-tabel in fase 2.
*/

const LOG_DIR = path.join(process.cwd(), "data");
const LOG_FILE = path.join(LOG_DIR, "clicks.log");

export interface ClickEntry {
  slug: string;
  kind: "event" | "sauna" | "product";
  destination: string;
  referer?: string;
  userAgent?: string;
}

export function logClick(entry: ClickEntry): void {
  const record = { ts: new Date().toISOString(), ...entry };
  const line = JSON.stringify(record);

  // Betrouwbaar in elke omgeving (verschijnt in Vercel-logs).
  console.log(`[uit-klik] ${line}`);

  // Best-effort bestands-append (lokaal / persistente FS).
  try {
    fs.mkdirSync(LOG_DIR, { recursive: true });
    fs.appendFileSync(LOG_FILE, `${line}\n`);
  } catch {
    // Stil falen: logging mag de redirect nooit blokkeren.
  }
}

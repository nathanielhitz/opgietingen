import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";

/*
  Helpers voor de opgietrooster-hercheck (scripts/check-roosters.ts).
  Roosters op sauna-profielen (frontmatter `opgietRooster` + `roosterGecheckt`)
  verouderen; deze helpers selecteren wat hercontrole nodig heeft en werken de
  gecheckt-datum bij met een minimale diff (regelvervanging in plaats van de
  hele frontmatter herschrijven).
*/

const SAUNAS_DIR = path.join(process.cwd(), "content", "saunas");

export interface RoosterRegel {
  dag: string;
  tijden: string;
}

export interface RoosterProfiel {
  slug: string;
  naam: string;
  filePath: string;
  website?: string;
  /** Pagina waar het rooster letterlijk staat (frontmatter `roosterBron`), als die afwijkt van de agenda-URL. */
  roosterBron?: string;
  rooster: RoosterRegel[];
  /** ISO-datum van de laatste controle, of undefined als die ontbreekt. */
  gecheckt?: string;
}

/** YAML parseert kale datums als Date; normaliseer naar ISO YYYY-MM-DD. */
function toISODate(value: unknown): string | undefined {
  if (value == null || value === "") return undefined;
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  const s = String(value);
  return /^\d{4}-\d{2}-\d{2}/.test(s) ? s.slice(0, 10) : undefined;
}

/** Alle sauna-profielen met een opgietRooster in de frontmatter. */
export function readRoosterProfielen(dir: string = SAUNAS_DIR): RoosterProfiel[] {
  if (!fs.existsSync(dir)) return [];
  const out: RoosterProfiel[] = [];
  for (const file of fs.readdirSync(dir).filter((f) => f.endsWith(".mdx"))) {
    const filePath = path.join(dir, file);
    const { data } = matter(fs.readFileSync(filePath, "utf-8"));
    const rooster = data.opgietRooster;
    if (!Array.isArray(rooster) || rooster.length === 0) continue;
    out.push({
      slug: file.replace(/\.mdx$/, ""),
      naam: String(data.naam ?? file),
      filePath,
      website: typeof data.website === "string" ? data.website : undefined,
      roosterBron: typeof data.roosterBron === "string" ? data.roosterBron : undefined,
      rooster: rooster
        .filter((r): r is RoosterRegel => !!r && typeof r === "object")
        .map((r) => ({ dag: String(r.dag ?? ""), tijden: String(r.tijden ?? "") })),
      gecheckt: toISODate(data.roosterGecheckt),
    });
  }
  return out;
}

/** Aantal hele dagen tussen de gecheckt-datum en vandaag; Infinity zonder datum. */
export function dagenSinds(gecheckt: string | undefined, vandaag: string): number {
  if (!gecheckt) return Infinity;
  const [gy, gm, gd] = gecheckt.split("-").map(Number);
  const [vy, vm, vd] = vandaag.split("-").map(Number);
  const ms = Date.UTC(vy, vm - 1, vd) - Date.UTC(gy, gm - 1, gd);
  return Math.floor(ms / 86_400_000);
}

export function isVerouderd(gecheckt: string | undefined, vandaag: string, maxDagen: number): boolean {
  return dagenSinds(gecheckt, vandaag) > maxDagen;
}

/** Rooster als leesbare tekst voor de vergelijkingsprompt. */
export function roosterNaarTekst(rooster: RoosterRegel[]): string {
  return rooster.map((r) => `- ${r.dag}: ${r.tijden}`).join("\n");
}

/**
 * Vervangt (of voegt toe) de regel `roosterGecheckt: <datum>` in het eerste
 * frontmatter-blok van een rauw MDX-bestand. Regelvervanging in plaats van
 * matter.stringify, zodat de rest van de frontmatter byte-voor-byte intact
 * blijft (minimale git-diff). Retourneert null als er geen frontmatter is.
 */
export function vervangRoosterGecheckt(raw: string, datum: string): string | null {
  const m = raw.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!m || m.index !== 0) return null;
  const fm = m[1];
  const nieuw = /^roosterGecheckt:/m.test(fm)
    ? fm.replace(/^roosterGecheckt:.*$/m, `roosterGecheckt: ${datum}`)
    : `${fm}\nroosterGecheckt: ${datum}`;
  return `---\n${nieuw}\n---${raw.slice(m[0].length)}`;
}

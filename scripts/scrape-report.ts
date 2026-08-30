// Bouwt het scraper-probleemrapport na een run (spec §3).
// - Afgekeurde concepts (status: concept + keurNotitie) uit content/events/ (status afgewezen = al beoordeeld, telt niet)
// - Niet-actieve bronnen (via bronnenReport()); alleen kapot/geen-agenda tellen
//   als "probleem" dat het issue openhoudt
// - Actieve bronnen zonder sauna-profiel ("profiel aanmaken" blijft handwerk)
// Schrijft het rapport naar scrape-issue.md en print "problemen" of "schoon".
import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import { readBronnen, existingSaunaSlugs } from "./lib/content";
import { readRoosterProfielen, dagenSinds } from "./lib/rooster";
import { bronnenReport } from "./bronnen-report";

const EVENTS_DIR = path.join(process.cwd(), "content", "events");
const ROOSTER_CHECK_PATH = path.join(process.cwd(), "rooster-check.json");
const SCRAPE_WARNINGS_PATH = path.join(process.cwd(), "scrape-warnings.json");

// Roosters die zó lang niet bevestigd zijn, zijn blijkbaar niet automatisch
// controleerbaar (check-roosters probeert vanaf 60 dagen) → handwerk nodig.
const ROOSTER_STALE_DAGEN = 90;

// Alleen deze niet-actieve statussen zijn "problematisch" en houden het issue
// open (spec §3: "gewijzigde/problematische status"). De overige niet-actieve
// statussen zijn bewuste registry-states (handmatig/opzetten/aanvullen) of
// transiënt (te-verifieren): die verschijnen wél in het rapport-body via
// bronnenReport(), maar mogen een schone run niet blokkeren — anders sluit het
// issue nooit en verliest "stilte = alles goed" zijn betekenis.
const PROBLEEM_STATUSSEN = new Set(["kapot", "geen-agenda"]);

interface ConceptProbleem {
  bestand: string;
  titel: string;
  keurNotitie: string;
}

function afgekeurdeConcepts(): ConceptProbleem[] {
  if (!fs.existsSync(EVENTS_DIR)) return [];
  const out: ConceptProbleem[] = [];
  for (const f of fs.readdirSync(EVENTS_DIR).filter((f) => f.endsWith(".mdx"))) {
    const { data } = matter(fs.readFileSync(path.join(EVENTS_DIR, f), "utf8"));
    if (data.bron === "scraper" && data.status === "concept" && data.keurNotitie) {
      out.push({ bestand: f, titel: String(data.titel ?? f), keurNotitie: String(data.keurNotitie) });
    }
  }
  return out;
}

function actieveZonderProfiel(): string[] {
  const { bronnen } = readBronnen();
  const slugs = existingSaunaSlugs();
  return bronnen.filter((b) => b.status === "actief" && !slugs.has(b.id)).map((b) => b.naam);
}

const SAUNAS_DIR = path.join(process.cwd(), "content", "saunas");

/**
 * Sauna-profielen zonder afbeelding én zonder logo tonen de gradient-
 * placeholder op de site; die willen we alleen als het echt niet anders kan.
 * `npm run fetch-logos` lost het meestal op; anders een sfeerbeeld genereren
 * via docs/image-prompts.md.
 */
function profielenZonderBeeld(): string[] {
  if (!fs.existsSync(SAUNAS_DIR)) return [];
  const out: string[] = [];
  for (const f of fs.readdirSync(SAUNAS_DIR).filter((f) => f.endsWith(".mdx"))) {
    const { data } = matter(fs.readFileSync(path.join(SAUNAS_DIR, f), "utf8"));
    if (!data.afbeelding && !data.logo) out.push(String(data.naam ?? f));
  }
  return out;
}

interface RoosterAandacht {
  naam: string;
  detail: string;
}

/** Waarschuwingen van de laatste scrape-run (scrape-warnings.json, indien aanwezig). */
function scrapeWarnings(): { bron: string; melding: string }[] {
  if (!fs.existsSync(SCRAPE_WARNINGS_PATH)) return [];
  try {
    const rapport = JSON.parse(fs.readFileSync(SCRAPE_WARNINGS_PATH, "utf8")) as {
      warnings?: { bron?: string; melding?: string }[];
    };
    return (rapport.warnings ?? []).map((w) => ({
      bron: String(w.bron ?? "?"),
      melding: String(w.melding ?? "onbekende waarschuwing"),
    }));
  } catch {
    return [{ bron: "scrape-warnings.json", melding: "rapport onleesbaar (geen geldige JSON)" }];
  }
}

/**
 * Opgietroosters die aandacht nodig hebben: door check-roosters gemelde
 * problemen (rooster-check.json, indien aanwezig) plus roosters die al
 * > ROOSTER_STALE_DAGEN niet bevestigd zijn (direct uit de frontmatter).
 */
function roosterProblemen(vandaag: string): RoosterAandacht[] {
  const out: RoosterAandacht[] = [];
  const gemeld = new Set<string>();

  if (fs.existsSync(ROOSTER_CHECK_PATH)) {
    try {
      const rapport = JSON.parse(fs.readFileSync(ROOSTER_CHECK_PATH, "utf8")) as {
        problemen?: { slug?: string; naam?: string; url?: string; probleem?: string }[];
      };
      for (const p of rapport.problemen ?? []) {
        if (p.slug) gemeld.add(p.slug);
        out.push({ naam: String(p.naam ?? p.slug ?? "?"), detail: String(p.probleem ?? "onbekend probleem") });
      }
    } catch {
      out.push({ naam: "rooster-check.json", detail: "rapport onleesbaar (geen geldige JSON)" });
    }
  }

  for (const p of readRoosterProfielen()) {
    if (gemeld.has(p.slug)) continue;
    const dagen = dagenSinds(p.gecheckt, vandaag);
    if (dagen > ROOSTER_STALE_DAGEN) {
      out.push({
        naam: p.naam,
        detail: p.gecheckt
          ? `rooster al ${dagen} dagen niet bevestigd (laatst gecheckt ${p.gecheckt})`
          : "rooster nog nooit gecheckt (roosterGecheckt ontbreekt)",
      });
    }
  }
  return out;
}

function main() {
  const concepts = afgekeurdeConcepts();
  const zonderProfiel = actieveZonderProfiel();
  const { bronnen } = readBronnen();
  const problematischeBronnen = bronnen.filter((b) => PROBLEEM_STATUSSEN.has(b.status));
  const roosters = roosterProblemen(new Date().toISOString().slice(0, 10));
  const warnings = scrapeWarnings();
  const zonderBeeld = profielenZonderBeeld();

  const problemen =
    concepts.length > 0 ||
    problematischeBronnen.length > 0 ||
    zonderProfiel.length > 0 ||
    roosters.length > 0 ||
    warnings.length > 0 ||
    zonderBeeld.length > 0;

  const lines: string[] = [];
  lines.push("<!-- scraper-issue -->");
  lines.push("# Scraper-rapport");
  lines.push("");

  if (concepts.length > 0) {
    lines.push("## ⚠ Twijfelgevallen (niet gepubliceerd)");
    lines.push("");
    lines.push("Deze events zijn als `concept` weggeschreven en staan **niet** live:");
    lines.push("");
    for (const c of concepts) {
      lines.push(`- **${c.titel}** (\`${c.bestand}\`) — ${c.keurNotitie}`);
    }
    lines.push("");
  }

  if (zonderProfiel.length > 0) {
    lines.push("## Actieve bronnen zonder sauna-profiel");
    lines.push("");
    lines.push("Maak handmatig een profiel aan in `content/saunas/` zodat events zichtbaar worden:");
    lines.push("");
    for (const naam of zonderProfiel) lines.push(`- ${naam}`);
    lines.push("");
  }

  if (zonderBeeld.length > 0) {
    lines.push("## Sauna-profielen met placeholder-beeld");
    lines.push("");
    lines.push("Deze profielen tonen de gradient-placeholder. Draai `npm run fetch-logos` of genereer een sfeerbeeld (docs/image-prompts.md):");
    lines.push("");
    for (const naam of zonderBeeld) lines.push(`- ${naam}`);
    lines.push("");
  }

  if (warnings.length > 0) {
    lines.push("## Scrape-waarschuwingen (laatste run)");
    lines.push("");
    lines.push("Fetch-/extractieproblemen en dedup-twijfels die geen concept opleverden maar wel aandacht verdienen:");
    lines.push("");
    for (const w of warnings) lines.push(`- **${w.bron}** — ${w.melding}`);
    lines.push("");
  }

  if (roosters.length > 0) {
    lines.push("## Opgietroosters: aandacht nodig");
    lines.push("");
    lines.push("Controleer deze roosters handmatig op de sauna-website en werk `opgietRooster`/`roosterGecheckt` bij:");
    lines.push("");
    for (const r of roosters) lines.push(`- **${r.naam}** — ${r.detail}`);
    lines.push("");
  }

  lines.push(bronnenReport());

  fs.writeFileSync("scrape-issue.md", lines.join("\n") + "\n");
  process.stdout.write(problemen ? "problemen\n" : "schoon\n");
}

main();

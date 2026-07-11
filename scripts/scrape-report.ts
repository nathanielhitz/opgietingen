// Bouwt het scraper-probleemrapport na een run (spec §3).
// - Afgekeurde concepts (status: concept + keurNotitie) uit content/events/
// - Niet-actieve bronnen (via bronnenReport()); alleen kapot/geen-agenda tellen
//   als "probleem" dat het issue openhoudt
// - Actieve bronnen zonder sauna-profiel ("profiel aanmaken" blijft handwerk)
// Schrijft het rapport naar scrape-issue.md en print "problemen" of "schoon".
import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import { readBronnen, existingSaunaSlugs } from "./lib/content";
import { bronnenReport } from "./bronnen-report";

const EVENTS_DIR = path.join(process.cwd(), "content", "events");

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

function main() {
  const concepts = afgekeurdeConcepts();
  const zonderProfiel = actieveZonderProfiel();
  const { bronnen } = readBronnen();
  const problematischeBronnen = bronnen.filter((b) => PROBLEEM_STATUSSEN.has(b.status));

  const problemen =
    concepts.length > 0 || problematischeBronnen.length > 0 || zonderProfiel.length > 0;

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

  lines.push(bronnenReport());

  fs.writeFileSync("scrape-issue.md", lines.join("\n") + "\n");
  process.stdout.write(problemen ? "problemen\n" : "schoon\n");
}

main();

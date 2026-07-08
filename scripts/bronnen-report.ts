/*
  Print een markdown-rapport van de bronnenstatus (voor in de scrape-PR).
  Toont tellingen + een tabel met alle niet-actieve bronnen (aandachtspunten).
*/
import { readBronnen } from "./lib/content";

const data = readBronnen();
const count = (s: string) => data.bronnen.filter((b) => b.status === s).length;

const lines: string[] = [];
lines.push("## Bronnenstatus");
lines.push("");
lines.push(
  `**actief:** ${count("actief")} · **geen-agenda:** ${count("geen-agenda")} · ` +
    `**handmatig:** ${count("handmatig")} · **kapot:** ${count("kapot")} · ` +
    `**te-verifieren:** ${count("te-verifieren")}`
);
lines.push("");

const aandacht = data.bronnen.filter((b) => b.status !== "actief");
if (aandacht.length > 0) {
  lines.push("### ⚠ Aandachtspunten (niet-actieve bronnen)");
  lines.push("");
  lines.push("| Bron | Land | Status | Notitie |");
  lines.push("| --- | --- | --- | --- |");
  for (const b of aandacht) {
    lines.push(`| ${b.naam} | ${b.land} | \`${b.status}\` | ${b.notities || "—"} |`);
  }
} else {
  lines.push("Alle bronnen zijn `actief`. 🎉");
}

process.stdout.write(lines.join("\n") + "\n");

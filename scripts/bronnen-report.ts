// Markdown-statusrapport van alle scraper-bronnen.
// Als module: bronnenReport() levert de string. Als script: print naar stdout.
import { readBronnen } from "./lib/content";

export function bronnenReport(): string {
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

  return lines.join("\n") + "\n";
}

// CLI-modus: alleen printen als dit bestand direct wordt uitgevoerd.
if (process.argv[1] && process.argv[1].endsWith("bronnen-report.ts")) {
  process.stdout.write(bronnenReport());
}

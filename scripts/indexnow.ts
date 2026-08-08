/*
  IndexNow-ping (GSC-indexeringsplan augustus 2026, fase 4.3).

  De site is jong en krijgt weinig crawl-budget: nieuwe events werden pas
  dagen tot weken na de wekelijkse scraper-commit opgehaald. IndexNow meldt
  gewijzigde URL's actief aan bij Bing/Yandex (en daarmee aan alle deelnemende
  zoekmachines). Google doet niet mee aan IndexNow — daar blijft de sitemap
  het kanaal.

  Bewust alleen de *gewijzigde* URL's, niet de hele sitemap: herhaald de
  complete site inleveren is spam-gedrag en kost je de vertrouwensbonus.

    1. Bepaalt via `git diff` welke content-bestanden in het gegeven bereik
       zijn toegevoegd/gewijzigd (default: de laatste commit).
    2. Vertaalt die naar publieke URL's — concept-events vallen af, want die
       zijn niet zichtbaar (de loader filtert ze).
    3. Voegt de lijstpagina's toe die door zo'n wijziging mee veranderen
       (home, agenda, de betreffende maand- en provinciepagina).
    4. POST naar api.indexnow.org.

  De sleutel is publiek — dat hoort zo bij IndexNow: het sleutelbestand staat
  in public/ en bewijst juist dat wij het domein beheren. Geen secret nodig.

  Gebruik:
    npm run indexnow                       # wijzigingen uit de laatste commit
    npm run indexnow -- --since HEAD~3     # groter bereik
    npm run indexnow -- --dry-run          # toon de URL's, verstuur niets
*/
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import matter from "gray-matter";
import { site } from "../src/lib/site";
import { monthYearSlug } from "../src/lib/dates";
import { slugify } from "../src/lib/content";

const PUBLIC_DIR = path.join(process.cwd(), "public");
const ENDPOINT = "https://api.indexnow.org/indexnow";

const DRY_RUN = process.argv.includes("--dry-run");
const SINCE = (() => {
  const i = process.argv.indexOf("--since");
  return i !== -1 ? process.argv[i + 1] : "HEAD~1";
})();

/**
 * De sleutel is het sleutelbestand: public/<key>.txt met de key als inhoud.
 * Zo is er één bron van waarheid en kan de key niet uit de pas lopen met wat
 * de zoekmachine op het domein ophaalt.
 */
function leesSleutel(): { key: string; keyLocation: string } | undefined {
  const kandidaten = fs
    .readdirSync(PUBLIC_DIR)
    .filter((f) => /^[a-f0-9]{8,128}\.txt$/i.test(f));
  for (const bestand of kandidaten) {
    const inhoud = fs.readFileSync(path.join(PUBLIC_DIR, bestand), "utf-8").trim();
    if (inhoud && bestand === `${inhoud}.txt`) {
      return { key: inhoud, keyLocation: `${site.url}/${bestand}` };
    }
  }
  return undefined;
}

/** Gewijzigde/toegevoegde bestanden in het bereik; verwijderde vallen af. */
function gewijzigdeBestanden(since: string): string[] {
  const out = execFileSync("git", ["diff", "--name-only", "--diff-filter=AM", since, "HEAD"], {
    encoding: "utf-8",
  });
  return out.split("\n").filter(Boolean);
}

function frontmatter(relPath: string): Record<string, unknown> | undefined {
  const abs = path.join(process.cwd(), relPath);
  if (!fs.existsSync(abs)) return undefined;
  return matter(fs.readFileSync(abs, "utf-8")).data;
}

async function main() {
  const sleutel = leesSleutel();
  if (!sleutel) {
    console.log(
      `Geen IndexNow-sleutelbestand in public/ gevonden (verwacht: <key>.txt met de key als inhoud). Overgeslagen.`,
    );
    return;
  }

  const urls = new Set<string>();
  const lijstpaginas = new Set<string>();

  for (const bestand of gewijzigdeBestanden(SINCE)) {
    if (!bestand.startsWith("content/") || !bestand.endsWith(".mdx")) continue;
    const slug = path.basename(bestand, ".mdx");

    if (bestand.startsWith("content/events/")) {
      const data = frontmatter(bestand);
      // Concept-events zijn onzichtbaar (loader filtert ze) — niet aanmelden.
      if (!data || data.status !== "gepubliceerd") continue;
      urls.add(`${site.url}/event/${slug}`);
      lijstpaginas.add(`${site.url}/`);
      lijstpaginas.add(`${site.url}/agenda`);
      const start = typeof data.startDatum === "string" ? data.startDatum : undefined;
      if (start) lijstpaginas.add(`${site.url}/agenda/${monthYearSlug(start)}`);
      // Provinciepagina via de sauna waar het event bij hoort.
      const saunaSlug = typeof data.saunaSlug === "string" ? data.saunaSlug : undefined;
      const sauna = saunaSlug ? frontmatter(`content/saunas/${saunaSlug}.mdx`) : undefined;
      if (sauna && typeof sauna.provincie === "string") {
        lijstpaginas.add(`${site.url}/opgietingen/${slugify(sauna.provincie)}`);
        urls.add(`${site.url}/sauna/${saunaSlug}`);
      }
    } else if (bestand.startsWith("content/saunas/")) {
      urls.add(`${site.url}/sauna/${slug}`);
      const data = frontmatter(bestand);
      if (data && typeof data.provincie === "string") {
        lijstpaginas.add(`${site.url}/opgietingen/${slugify(data.provincie)}`);
      }
      lijstpaginas.add(`${site.url}/saunas`);
    } else if (bestand.startsWith("content/gidsen/")) {
      urls.add(`${site.url}/gids/${slug}`);
      lijstpaginas.add(`${site.url}/gids`);
    } else if (bestand.startsWith("content/provincies/")) {
      urls.add(`${site.url}/opgietingen/${slug}`);
    }
  }

  const urlList = [...urls, ...lijstpaginas].sort();
  if (urlList.length === 0) {
    console.log(`Geen gewijzigde publieke URL's sinds ${SINCE}. Niets aan te melden.`);
    return;
  }

  console.log(`${urlList.length} URL's sinds ${SINCE}:`);
  for (const u of urlList) console.log(`  ${u}`);

  if (DRY_RUN) {
    console.log("\n--dry-run: niets verstuurd.");
    return;
  }

  const host = new URL(site.url).host;
  try {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify({ host, key: sleutel.key, keyLocation: sleutel.keyLocation, urlList }),
    });
    // 200 = geaccepteerd, 202 = geaccepteerd maar key nog niet gevalideerd.
    console.log(`IndexNow antwoordde met ${res.status} ${res.statusText}.`);
  } catch (err) {
    // Een fout hier mag de workflow niet laten falen: dit is een extraatje
    // bovenop de sitemap, geen kritiek pad.
    console.log(`IndexNow-ping mislukt (niet fataal): ${err instanceof Error ? err.message : err}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

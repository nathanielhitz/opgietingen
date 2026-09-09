/*
  Zoekt Instagram-handles op de eigen websites van sauna-profielen zonder
  `instagram`-veld en print voorstellen. Schrijft niets: een handle opvoeren
  is een claim over de sauna, dus die gaat handmatig het profiel in.

    npm run vind-instagram
    npm run vind-instagram -- --sauna <slug>   # her-scan één profiel, ook als het al een instagram-veld heeft
*/
import { getAllSaunas } from "../src/lib/content";
import { fetchUrl, isAllowed, sleep, REQUEST_DELAY_MS } from "./lib/net";

function flag(naam: string): string | undefined {
  const i = process.argv.indexOf(naam);
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : undefined;
}

const SAUNA = flag("--sauna");

// Paden op instagram.com die geen profiel zijn.
const GEEN_PROFIEL = new Set(["p", "reel", "reels", "explore", "accounts", "share", "stories", "tv", "about", "legal", "directory", "developer", "web", "embed", "embed.js"]);

async function main() {
  const alleSaunas = getAllSaunas();
  if (SAUNA && !alleSaunas.some((s) => s.slug === SAUNA)) {
    console.log(`Geen sauna-profiel met slug "${SAUNA}".`);
    process.exit(1);
    return;
  }
  const saunas = SAUNA
    ? alleSaunas.filter((s) => s.slug === SAUNA)
    : alleSaunas.filter((s) => s.website && !s.instagram);
  console.log(
    SAUNA
      ? `1 profiel geselecteerd via --sauna.\n`
      : `${saunas.length} profielen zonder instagram-veld.\n`,
  );
  for (const s of saunas) {
    if (!s.website) {
      console.log(`${s.slug.padEnd(28)} geen website in het profiel`);
      continue;
    }
    const site = s.website;
    if (!(await isAllowed(site))) {
      console.log(`${s.slug.padEnd(28)} robots.txt staat ophalen niet toe`);
      continue;
    }
    const res = await fetchUrl(site, 15000);
    if (!res.ok) {
      console.log(`${s.slug.padEnd(28)} fout: ${res.error ?? `HTTP ${res.status}`}`);
      continue;
    }
    const handles = new Set<string>();
    for (const m of res.body.matchAll(/(?<![a-z0-9])instagram\.com\/([A-Za-z0-9._]{1,30})/gi)) {
      if (!GEEN_PROFIEL.has(m[1].toLowerCase())) handles.add(m[1].replace(/\.$/, ""));
    }
    console.log(`${s.slug.padEnd(28)} ${handles.size > 0 ? [...handles].join(", ") : "-"}`);
    await sleep(REQUEST_DELAY_MS);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

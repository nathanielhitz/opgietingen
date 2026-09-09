/*
  Zoekt Instagram-handles op de eigen websites van sauna-profielen zonder
  `instagram`-veld en print voorstellen. Schrijft niets: een handle opvoeren
  is een claim over de sauna, dus die gaat handmatig het profiel in.

    npm run vind-instagram
*/
import { getAllSaunas } from "../src/lib/content";
import { fetchUrl, isAllowed, sleep, REQUEST_DELAY_MS } from "./lib/net";

// Paden op instagram.com die geen profiel zijn.
const GEEN_PROFIEL = new Set(["p", "reel", "reels", "explore", "accounts", "share", "stories", "tv", "about", "legal", "directory", "developer", "web"]);

async function main() {
  const saunas = getAllSaunas().filter((s) => s.website && !s.instagram);
  console.log(`${saunas.length} profielen zonder instagram-veld.\n`);
  for (const s of saunas) {
    const site = s.website!;
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
    for (const m of res.body.matchAll(/instagram\.com\/([A-Za-z0-9._]{1,30})/g)) {
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

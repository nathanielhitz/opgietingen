/*
  Verifieert de agendaUrl's in content/bronnen.json.
  Per bron met status "te-verifieren":
    - respecteert robots.txt
    - haalt de URL op (volgt redirects)
    - zoekt de juiste agenda-/opgietpagina als het pad afwijkt (via sitemap +
      links op de homepage, gescoord op relevante trefwoorden)
    - schrijft status "actief" + de juiste URL, of "kapot" met notitie terug.

  Draaien: npm run verify-bronnen   (of: npm run verify-bronnen -- --all om
  ook al-geverifieerde bronnen opnieuw te controleren)
*/
import { readBronnen, writeBronnen, type Bron } from "./lib/content";
import { fetchUrl, getRobots, isPathAllowed, sleep, REQUEST_DELAY_MS, type FetchResult } from "./lib/net";
import { scoreUrl, type Scored } from "./lib/discovery";
import { firecrawlFetchMarkdown } from "../src/lib/scraper";

const CONTENT_HINT = /(aufguss|opgiet|agenda)/i;
const TODAY = new Date().toISOString().slice(0, 10);

function sameHost(a: string, b: string): boolean {
  try {
    return new URL(a).host === new URL(b).host;
  } catch {
    return false;
  }
}

/** Sitemap-URLs uit robots.txt + /sitemap.xml, plus de <loc>-inhoud daarvan. */
async function candidatesFromSitemaps(origin: string): Promise<string[]> {
  const robotsRes = await fetchUrl(`${origin}/robots.txt`, 10000);
  const sitemapUrls = new Set<string>([`${origin}/sitemap.xml`]);
  if (robotsRes.ok) {
    for (const m of robotsRes.body.matchAll(/^\s*sitemap:\s*(\S+)/gim)) sitemapUrls.add(m[1]);
  }

  const locs = new Set<string>();
  for (const sm of sitemapUrls) {
    const res = await fetchUrl(sm, 15000);
    if (!res.ok) continue;
    for (const m of res.body.matchAll(/<loc>([^<]+)<\/loc>/gi)) {
      const url = m[1].trim();
      if (sameHost(url, origin)) locs.add(url);
    }
  }
  return [...locs];
}

/** Links op de homepage die naar een agenda-/opgietpagina kunnen wijzen. */
async function candidatesFromRoot(origin: string): Promise<string[]> {
  const res = await fetchUrl(origin, 20000);
  if (!res.ok) return [];
  const urls = new Set<string>();
  for (const m of res.body.matchAll(/href="([^"]+)"/gi)) {
    try {
      const abs = new URL(m[1], res.finalUrl).toString();
      if (sameHost(abs, origin)) urls.add(abs.split("#")[0]);
    } catch {
      /* negeer ongeldige href */
    }
  }
  return [...urls];
}

interface Resolution {
  status: "actief" | "geen-agenda" | "kapot";
  url: string;
  notitie: string;
}

async function resolveAgenda(bron: Bron): Promise<Resolution> {
  let origin: string;
  try {
    origin = new URL(bron.agendaUrl).origin;
  } catch {
    return { status: "kapot", url: bron.agendaUrl, notitie: "Ongeldige URL." };
  }

  // robots.txt naleven.
  const robots = await getRobots(origin);
  const check = (u: string) => {
    try {
      const parsed = new URL(u);
      return isPathAllowed(robots, parsed.pathname + parsed.search);
    } catch {
      return false;
    }
  };

  // 1. Probeer de opgegeven URL + bepaal of de host überhaupt bereikbaar is.
  // robots.txt geldt óók voor onze eigen directe fetches, niet alleen voor
  // discovery-kandidaten.
  const geblokkeerd: FetchResult = {
    ok: false,
    status: 0,
    finalUrl: bron.agendaUrl,
    body: "",
    error: "geblokkeerd door robots.txt",
  };
  const direct = check(bron.agendaUrl) ? await fetchUrl(bron.agendaUrl) : geblokkeerd;
  const isOrigin = bron.agendaUrl === origin || bron.agendaUrl === `${origin}/`;
  const rootRes = isOrigin ? direct : check(`${origin}/`) ? await fetchUrl(origin) : geblokkeerd;

  if (!check(bron.agendaUrl) && !check(`${origin}/`)) {
    return {
      status: "geen-agenda",
      url: bron.agendaUrl,
      notitie: "robots.txt blokkeert de agenda-URL en de homepage — niet scrapen; handmatig controleren.",
    };
  }

  const hostReachable = direct.ok || rootRes.ok;
  if (!hostReachable) {
    const reason = direct.error || rootRes.error || `HTTP ${direct.status}`;
    return { status: "kapot", url: bron.agendaUrl, notitie: `Host onbereikbaar: ${reason}` };
  }

  // Gecureerde vaste URL: alleen bereikbaarheid + inhoud checken, nooit
  // herschrijven of opnieuw ontdekken (voorkomt churn zoals lago-brugge →
  // valentijn-2026).
  if (bron.agendaUrlVast) {
    if (direct.ok && CONTENT_HINT.test(direct.body)) {
      return { status: "actief", url: bron.agendaUrl, notitie: "Bevestigd (vaste URL)." };
    }
    if (check(bron.agendaUrl)) {
      const md = await firecrawlFetchMarkdown(bron.agendaUrl);
      if (md && CONTENT_HINT.test(md)) {
        return { status: "actief", url: bron.agendaUrl, notitie: "Bevestigd via Firecrawl (vaste URL)." };
      }
    }
    return {
      status: "geen-agenda",
      url: bron.agendaUrl,
      notitie: `Vaste URL gaf HTTP ${direct.status || "fout"} of geen agenda-inhoud — handmatig controleren.`,
    };
  }

  // 2. Verzamel kandidaten (opgegeven URL + sitemap + homepage-links).
  const raw = new Set<string>();
  // Redirect naar een andere host is geen geldige kandidaat (geparkeerde/
  // overgenomen domeinen zouden anders als "actief" doorlekken).
  if (direct.ok && sameHost(direct.finalUrl, origin)) raw.add(direct.finalUrl);
  for (const u of await candidatesFromSitemaps(origin)) raw.add(u);
  if (check(`${origin}/`)) {
    for (const u of await candidatesFromRoot(origin)) raw.add(u);
  }

  const scored = [...raw]
    .filter(check)
    .map((u) => scoreUrl(u, bron.matchToken, bron.agendaUrl))
    .filter((c): c is Scored => c !== null)
    .sort((a, b) => b.score - a.score || a.depth - b.depth || a.url.length - b.url.length)
    .slice(0, 6);

  // 3. Verifieer topkandidaten: 200 + relevante inhoud.
  for (const cand of scored) {
    const res = await fetchUrl(cand.url);
    await sleep(400);
    if (res.ok && CONTENT_HINT.test(res.body)) {
      const note = cand.url === bron.agendaUrl ? "Bevestigd." : `Pad bijgewerkt (score ${cand.score}).`;
      return { status: "actief", url: cand.url, notitie: note };
    }
  }

  // Firecrawl-fallback (spec §4): kale fetch vond geen agendapagina —
  // mogelijk JS-gerenderd. Probeer echte browser-rendering, robots blijft gelden.
  if (check(bron.agendaUrl)) {
    const md = await firecrawlFetchMarkdown(bron.agendaUrl);
    if (md && CONTENT_HINT.test(md)) {
      return {
        status: "actief",
        url: bron.agendaUrl,
        notitie: "Bevestigd via Firecrawl (JS-gerenderd).",
      };
    }
  }

  // 4. Host is bereikbaar, maar geen aparte agendapagina gevonden op statische
  // HTML. De opgegeven URL blijft staan: één transiënte fout (500/timeout/
  // Firecrawl-quota) mag een gecureerde URL niet permanent vernietigen.
  const detail = direct.ok ? "" : ` (opgegeven pad gaf HTTP ${direct.status})`;
  return {
    status: "geen-agenda",
    url: bron.agendaUrl,
    notitie: `Host bereikbaar, maar geen aparte agendapagina gevonden (mogelijk JS-gerenderd)${detail} — handmatig controleren.`,
  };
}

async function main() {
  const all = process.argv.includes("--all");
  const data = readBronnen();

  // Niet-verifieerbare bronnen overslaan: handmatig/placeholder-statussen,
  // niet-website-types en bronnen zonder agenda-URL.
  const skip = (b: Bron) =>
    ["handmatig", "aanvullen", "opzetten"].includes(b.status) ||
    b.type === "handmatig" ||
    b.type === "nieuwsbrief" ||
    !b.agendaUrl;

  const todo = data.bronnen.filter((b) => !skip(b) && (all || b.status === "te-verifieren"));
  console.log(`Verifieer ${todo.length} van ${data.bronnen.length} bronnen…\n`);

  for (const bron of data.bronnen) {
    if (!todo.includes(bron)) continue;
    process.stdout.write(`• ${bron.naam} (${bron.agendaUrl}) … `);
    const result = await resolveAgenda(bron);
    bron.status = result.status;
    bron.agendaUrl = result.url;
    // Curatienotities niet wegpoetsen: bij een simpele herbevestiging blijft
    // een bestaande (handmatige) notitie staan.
    if (!/^Bevestigd/.test(result.notitie) || !bron.notities) {
      bron.notities = result.notitie;
    }
    bron.laatstGecontroleerd = TODAY;
    console.log(`${result.status.toUpperCase()} → ${result.url}\n  ${result.notitie}`);
    await sleep(REQUEST_DELAY_MS);
  }

  writeBronnen(data);
  const count = (s: string) => data.bronnen.filter((b) => b.status === s).length;
  console.log(
    `\nKlaar. actief: ${count("actief")}, geen-agenda: ${count("geen-agenda")}, ` +
      `handmatig: ${count("handmatig")}, kapot: ${count("kapot")}. bronnen.json bijgewerkt.`
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

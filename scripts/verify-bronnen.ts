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
import { fetchUrl, getRobots, isPathAllowed, sleep, REQUEST_DELAY_MS } from "./lib/net";

const KEYWORD_SCORE: Array<[RegExp, number]> = [
  [/agenda/i, 50],
  [/aufguss/i, 40],
  [/opgiet/i, 40],
  [/event/i, 20],
  [/programma/i, 20],
];

const CONTENT_HINT = /(aufguss|opgiet|agenda)/i;
// Losse artikelen/nieuws/overige pagina's zijn geen agenda-overzicht → uitsluiten.
const DISQUALIFY = /(^|\/)(blog|nieuws|news|artikel|pers|werkenbij|vacature|sponsor|faq|contact|over|arrangement)/i;
const TODAY = new Date().toISOString().slice(0, 10);

interface Scored {
  url: string;
  score: number;
  depth: number;
}

function scoreUrl(url: string, matchToken?: string): Scored | null {
  let path: string;
  try {
    path = new URL(url).pathname.toLowerCase();
  } catch {
    return null;
  }
  if (DISQUALIFY.test(path)) return null;

  let score = 0;
  for (const [re, pts] of KEYWORD_SCORE) if (re.test(path)) score += pts;
  if (matchToken && path.includes(matchToken.toLowerCase())) score += 100;
  if (score === 0) return null;

  const depth = path.split("/").filter(Boolean).length;
  // Voorkeur voor ondiepe sectiepagina's boven diepe URLs.
  return { url, score: score - Math.max(0, depth - 1) * 10, depth };
}

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
  status: "actief" | "kapot";
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

  // 1. Probeer de opgegeven URL.
  const direct = await fetchUrl(bron.agendaUrl);
  if (direct.error && direct.status === 0) {
    return { status: "kapot", url: bron.agendaUrl, notitie: `Host onbereikbaar: ${direct.error}` };
  }

  // 2. Verzamel kandidaten (opgegeven URL + sitemap + homepage-links).
  const raw = new Set<string>();
  if (direct.ok) raw.add(direct.finalUrl);
  for (const u of await candidatesFromSitemaps(origin)) raw.add(u);
  for (const u of await candidatesFromRoot(origin)) raw.add(u);

  const scored = [...raw]
    .filter(check)
    .map((u) => scoreUrl(u, bron.matchToken))
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

  // 4. Geen betere kandidaat, maar opgegeven URL werkte wel.
  if (direct.ok && check(direct.finalUrl)) {
    return { status: "actief", url: direct.finalUrl, notitie: "Bevestigd (geen agenda-trefwoord in pad)." };
  }

  if (direct.ok && !check(direct.finalUrl)) {
    return { status: "kapot", url: bron.agendaUrl, notitie: "Geblokkeerd door robots.txt." };
  }

  return { status: "kapot", url: bron.agendaUrl, notitie: `Geen agendapagina gevonden (HTTP ${direct.status}).` };
}

async function main() {
  const all = process.argv.includes("--all");
  const data = readBronnen();

  const todo = data.bronnen.filter((b) => all || b.status === "te-verifieren");
  console.log(`Verifieer ${todo.length} van ${data.bronnen.length} bronnen…\n`);

  for (const bron of data.bronnen) {
    if (!todo.includes(bron)) continue;
    process.stdout.write(`• ${bron.naam} (${bron.agendaUrl}) … `);
    const result = await resolveAgenda(bron);
    bron.status = result.status;
    bron.agendaUrl = result.url;
    bron.notitie = result.notitie;
    bron.laatstGecontroleerd = TODAY;
    console.log(`${result.status.toUpperCase()} → ${result.url}\n  ${result.notitie}`);
    await sleep(REQUEST_DELAY_MS);
  }

  writeBronnen(data);
  const actief = data.bronnen.filter((b) => b.status === "actief").length;
  const kapot = data.bronnen.filter((b) => b.status === "kapot").length;
  console.log(`\nKlaar. Actief: ${actief}, kapot: ${kapot}. bronnen.json bijgewerkt.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

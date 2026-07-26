/*
  Logo-fetcher: haalt voor sauna-profielen zónder beeld (geen `afbeelding` en
  geen `logo` in de frontmatter) het logo van de sauna-website en werkt de
  frontmatter bij. Daarmee valt de kaart terug op het echte logo in plaats van
  de gradient-placeholder (CoverImage: foto → logo → gradient).

  Kandidaten per site, in volgorde van betrouwbaarheid:
    1. JSON-LD (application/ld+json) met een "logo"-veld
    2. <img> met "logo" in src/class/alt/id
    3. <link rel="apple-touch-icon"> (meestal een vierkant logo ≥ 180px)

  Rasterbeelden worden met sharp gecontroleerd (minimaal formaat) en op
  helderheid geanalyseerd: overwegend witte/lichte logo's krijgen
  `logoAchtergrond: donker` zodat ze op de donkere tegel leesbaar zijn.
  SVG's worden ongewijzigd opgeslagen (analyse niet betrouwbaar; check
  visueel). robots.txt wordt nageleefd; bestaande bestanden/frontmatter
  worden nooit overschreven.

  Gebruik:
    npm run fetch-logos               # alle profielen zonder beeld
    npm run fetch-logos -- --dry-run  # toon alleen de gekozen kandidaat
    npm run fetch-logos -- --limit 3
*/
import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import sharp from "sharp";
import { fetchUrl, isAllowed, sleep, REQUEST_DELAY_MS, USER_AGENT } from "./lib/net";

const SAUNAS_DIR = path.join(process.cwd(), "content", "saunas");
const LOGOS_DIR = path.join(process.cwd(), "public", "images", "logos");
const MAX_BYTES = 2 * 1024 * 1024;
/** Kleinere rasterlogo's dan dit zijn favicons/ruis. */
const MIN_PIXELS = 64;
/** Gemiddelde luminantie (0-1) waarboven een logo als "wit/licht" telt. */
const LICHT_DREMPEL = 0.82;

function argValue(name: string): string | undefined {
  const i = process.argv.indexOf(name);
  return i !== -1 ? process.argv[i + 1] : undefined;
}
const DRY_RUN = process.argv.includes("--dry-run");
const rawLimit = Number(argValue("--limit"));
const LIMIT = Number.isFinite(rawLimit) && rawLimit > 0 ? rawLimit : Infinity;

interface Profiel {
  slug: string;
  naam: string;
  filePath: string;
  website?: string;
}

function profielenZonderBeeld(): Profiel[] {
  const out: Profiel[] = [];
  for (const f of fs.readdirSync(SAUNAS_DIR).filter((f) => f.endsWith(".mdx"))) {
    const filePath = path.join(SAUNAS_DIR, f);
    const { data } = matter(fs.readFileSync(filePath, "utf-8"));
    if (data.afbeelding || data.logo) continue;
    out.push({
      slug: f.replace(/\.mdx$/, ""),
      naam: String(data.naam ?? f),
      filePath,
      website: typeof data.website === "string" ? data.website : undefined,
    });
  }
  return out;
}

/** Zoekt logo-kandidaat-URL's in de HTML, beste eerst. */
export function vindLogoKandidaten(html: string, baseUrl: string): string[] {
  const abs = (u: string): string | null => {
    try {
      return new URL(u.trim(), baseUrl).toString();
    } catch {
      return null;
    }
  };
  const out: string[] = [];

  // 1. JSON-LD "logo" (string of {url}).
  for (const m of html.matchAll(/<script[^>]*application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      const doc = JSON.parse(m[1]);
      const stack = [doc];
      while (stack.length) {
        const node = stack.pop();
        if (!node || typeof node !== "object") continue;
        const logo = (node as Record<string, unknown>).logo;
        if (typeof logo === "string") {
          const u = abs(logo);
          if (u) out.push(u);
        } else if (logo && typeof logo === "object" && typeof (logo as { url?: string }).url === "string") {
          const u = abs((logo as { url: string }).url);
          if (u) out.push(u);
        }
        for (const v of Object.values(node)) if (v && typeof v === "object") stack.push(v);
      }
    } catch {
      /* ongeldig JSON-LD negeren */
    }
  }

  // 2. <img> met "logo" in src/class/alt/id (src of data-src voor lazyload).
  // custom-logo (WordPress' eigen site-logo-class) eerst: veel sites tonen in
  // de footer óók het logo van hun webbureau met "logo" in de bestandsnaam.
  const imgKandidaten: { url: string; prioriteit: number }[] = [];
  for (const m of html.matchAll(/<img\b[^>]*>/gi)) {
    const tag = m[0];
    if (!/logo/i.test(tag)) continue;
    const src = tag.match(/\bdata-src="([^"]+)"/i)?.[1] ?? tag.match(/\bsrc="([^"]+)"/i)?.[1];
    if (!src || src.startsWith("data:")) continue;
    const u = abs(src);
    if (!u) continue;
    imgKandidaten.push({ url: u, prioriteit: /custom-logo|site-logo|navbar|header/i.test(tag) ? 0 : 1 });
  }
  imgKandidaten.sort((a, b) => a.prioriteit - b.prioriteit);
  out.push(...imgKandidaten.map((k) => k.url));

  // 3. apple-touch-icon (meestal een vierkante logovariant).
  for (const m of html.matchAll(/<link\b[^>]*rel="[^"]*apple-touch-icon[^"]*"[^>]*>/gi)) {
    const href = m[0].match(/\bhref="([^"]+)"/i)?.[1];
    if (!href) continue;
    const u = abs(href);
    if (u) out.push(u);
  }

  return [...new Set(out)];
}

function extensieVoor(contentType: string, url: string): string | null {
  if (/svg/i.test(contentType) || /\.svg(\?|$)/i.test(url)) return "svg";
  if (/png/i.test(contentType)) return "png";
  if (/jpe?g/i.test(contentType)) return "jpg";
  if (/webp/i.test(contentType)) return "webp";
  return null; // ico/gif/onbekend: overslaan
}

async function downloadBinary(url: string): Promise<{ buf: Buffer; ext: string } | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20000);
  try {
    const res = await fetch(url, {
      redirect: "follow",
      signal: controller.signal,
      headers: { "User-Agent": USER_AGENT, Accept: "image/*,*/*;q=0.8" },
    });
    if (!res.ok) return null;
    const ext = extensieVoor(res.headers.get("content-type") ?? "", url);
    if (!ext) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.byteLength === 0 || buf.byteLength > MAX_BYTES) return null;
    return { buf, ext };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Beoordeelt een rasterlogo: groot genoeg? En is het overwegend licht/wit
 * (→ heeft een donkere tegel nodig)? Retourneert null wanneer onbruikbaar.
 */
async function analyseerRaster(buf: Buffer): Promise<{ donker: boolean } | null> {
  try {
    const img = sharp(buf);
    const meta = await img.metadata();
    if (!meta.width || !meta.height || Math.max(meta.width, meta.height) < MIN_PIXELS) return null;

    const { data, info } = await img
      .resize(48, 48, { fit: "inside" })
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    let som = 0;
    let n = 0;
    for (let i = 0; i < data.length; i += info.channels) {
      const a = data[i + 3] / 255;
      if (a < 0.5) continue; // transparante pixels tellen niet mee
      const lum = (0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2]) / 255;
      som += lum;
      n++;
    }
    if (n === 0) return null;
    return { donker: som / n > LICHT_DREMPEL };
  } catch {
    return null;
  }
}

/** Voegt frontmatter-regels toe direct vóór de sluitende ---. */
function voegFrontmatterToe(raw: string, regels: string[]): string | null {
  const m = raw.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!m || m.index !== 0) return null;
  return `---\n${m[1]}\n${regels.join("\n")}\n---${raw.slice(m[0].length)}`;
}

async function main() {
  const targets = profielenZonderBeeld().slice(0, LIMIT);
  console.log(`Logo-fetcher${DRY_RUN ? " (DRY-RUN)" : ""}: ${targets.length} profiel(en) zonder beeld.\n`);
  fs.mkdirSync(LOGOS_DIR, { recursive: true });

  let gelukt = 0;
  const nietGevonden: string[] = [];

  for (const p of targets) {
    if (!p.website) {
      nietGevonden.push(`${p.naam} (geen website)`);
      continue;
    }
    if (!(await isAllowed(p.website))) {
      nietGevonden.push(`${p.naam} (robots.txt blokkeert)`);
      continue;
    }

    const res = await fetchUrl(p.website);
    if (!res.ok) {
      nietGevonden.push(`${p.naam} (site onbereikbaar: HTTP ${res.status})`);
      await sleep(REQUEST_DELAY_MS);
      continue;
    }

    const kandidaten = vindLogoKandidaten(res.body, res.finalUrl);
    let geplaatst = false;
    for (const url of kandidaten) {
      const dl = await downloadBinary(url);
      if (!dl) continue;

      let donker = false;
      if (dl.ext !== "svg") {
        const analyse = await analyseerRaster(dl.buf);
        if (!analyse) continue; // te klein/onleesbaar → volgende kandidaat
        donker = analyse.donker;
      }

      if (DRY_RUN) {
        console.log(`✓ ${p.naam}: zou ${url} gebruiken (${dl.ext}${donker ? ", donker" : ""})`);
        geplaatst = true;
        break;
      }

      const bestandsnaam = `${p.slug}.${dl.ext}`;
      const doel = path.join(LOGOS_DIR, bestandsnaam);
      if (fs.existsSync(doel)) {
        console.log(`= ${p.naam}: ${bestandsnaam} bestond al; alleen frontmatter bijgewerkt.`);
      } else {
        fs.writeFileSync(doel, dl.buf);
      }

      const regels = [`logo: /images/logos/${bestandsnaam}`];
      if (donker) regels.push("logoAchtergrond: donker");
      const raw = fs.readFileSync(p.filePath, "utf-8");
      const nieuw = voegFrontmatterToe(raw, regels);
      if (!nieuw) {
        nietGevonden.push(`${p.naam} (frontmatter niet aanpasbaar)`);
        break;
      }
      fs.writeFileSync(p.filePath, nieuw);
      console.log(`✓ ${p.naam}: ${url} → ${bestandsnaam}${donker ? " (logoAchtergrond: donker)" : ""}`);
      gelukt++;
      geplaatst = true;
      break;
    }

    if (!geplaatst && !DRY_RUN) nietGevonden.push(`${p.naam} (geen bruikbare logo-kandidaat)`);
    await sleep(REQUEST_DELAY_MS);
  }

  console.log(`\nKlaar. ${gelukt} logo('s) geplaatst.`);
  if (nietGevonden.length) {
    console.log("Handmatig nodig (sfeerbeeld genereren via docs/image-prompts.md, of logo handmatig):");
    for (const n of nietGevonden) console.log(`- ${n}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

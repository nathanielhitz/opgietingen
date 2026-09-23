/*
  Buffer-adapter: leest de weekplanning van de site (/social/planning) en zet
  elke post ingepland in Buffer voor Facebook, Instagram en TikTok. Draait
  wekelijks vanuit .github/workflows/social.yml. Spec:
  docs/superpowers/specs/2026-09-23-social-buffer-adapter-design.md

    npm run social-buffer                          # inplannen (vereist BUFFER_API_KEY)
    npm run social-buffer -- --concept             # alles als concept in Buffer (verificatie; grootboek blijft ongemoeid)
    npm run social-buffer -- --dry-run             # toon wat er zou gebeuren; geen schrijvende Buffer-aanroepen (met sleutel worden wel de kanalen opgevraagd), schrijft niets
    npm run social-buffer -- --kanalen             # print de gekoppelde kanalen met id en stop (vereist BUFFER_API_KEY)
    npm run social-buffer -- --datum 2026-09-28    # andere referentiedatum (default: vandaag NL-tijd)
    npm run social-buffer -- --basis http://localhost:3000   # alleen zinvol met --dry-run/--kanalen

  Env: BUFFER_API_KEY (zonder: overslaan met exitcode 0), optioneel
       BUFFER_KANAAL_FACEBOOK / _INSTAGRAM / _TIKTOK (kanaal-id-override);
       in CI RUNNER_COMMIT (versheidscheck; valt terug op GITHUB_SHA), GITHUB_RUN_ID,
       GITHUB_STEP_SUMMARY, GITHUB_OUTPUT.
*/
import fs from "node:fs";
import { isGeldigeIsoDatum, todayISOInTimeZone } from "../src/lib/dates";
import { KANALEN, type Kanaal } from "../src/lib/social";
import type { PlanningJson } from "../src/lib/social-planning";
import { leesGrootboek, schrijfGrootboek, voegRegelToe, zoekRegel, SOCIAL_BUFFER_LOG_PATH } from "../src/lib/social-buffer-log";
import { maakBufferClient, type BufferClient, type BufferKanaal, type BufferPost } from "./lib/buffer-client";
import {
  besluit,
  bouwInput,
  commitKomtOvereen,
  kiesPosts,
  ontdekKanalen,
  overridesUitEnv,
  resultaatTabel,
  type KanaalIds,
  type Modus,
  type Ontdekking,
  type Resultaat,
} from "./lib/social-buffer";

function flag(naam: string, standaard: string): string {
  const i = process.argv.indexOf(naam);
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : standaard;
}

const DATUM = flag("--datum", todayISOInTimeZone());
const BASIS = flag("--basis", "https://opgietingen.nl").replace(/\/$/, "");
const CONCEPT = process.argv.includes("--concept");
const DRY_RUN = process.argv.includes("--dry-run");
const ALLEEN_KANALEN = process.argv.includes("--kanalen");
const MODUS: Modus = DRY_RUN ? "dry-run" : CONCEPT ? "concept" : "inplannen";

/** Versheidscheck: zo lang wachten op de Vercel-deploy van de scrape-commit, in stappen van 30 s. */
const WACHT_MAX_MS = 10 * 60_000;
const WACHT_STAP_MS = 30_000;

const wacht = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Fout waarbij opnieuw proberen zin heeft (netwerk, 5xx, half uitgerolde deploy). */
class TijdelijkeFout extends Error {}

/** Samenvatting voor de workflow: $GITHUB_STEP_SUMMARY en de output `ingepland`. */
function meldAanCi(inhoud: string, ingepland: number): void {
  if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, `## Social-posts ${DATUM} (${MODUS})\n\n${inhoud}\n`);
  if (process.env.GITHUB_OUTPUT) fs.appendFileSync(process.env.GITHUB_OUTPUT, `ingepland=${ingepland}\n`);
}

/** Eén poging; tijdelijke problemen als TijdelijkeFout, de rest als gewone fout. */
async function haalPlanningEenmaal(url: string): Promise<PlanningJson> {
  let res: Response;
  try {
    res = await fetch(url, { signal: AbortSignal.timeout(20_000) });
  } catch (err) {
    throw new TijdelijkeFout(`Planning onbereikbaar: ${url} (${err instanceof Error ? err.message : String(err)})`);
  }
  if (res.status >= 500) throw new TijdelijkeFout(`Planning ophalen mislukt: ${url} → HTTP ${res.status}`);
  if (!res.ok) throw new Error(`Planning ophalen mislukt: ${url} → HTTP ${res.status}`);
  let planning: PlanningJson;
  try {
    planning = (await res.json()) as PlanningJson;
  } catch {
    throw new TijdelijkeFout(`Planning is geen JSON: ${url}`);
  }
  if (!planning || !Array.isArray(planning.posts)) throw new Error(`Planning heeft geen posts-lijst: ${url}`);
  return planning;
}

async function haalPlanning(): Promise<PlanningJson> {
  const url = `${BASIS}/social/planning?datum=${DATUM}`;
  // De commit die de workflow uitcheckte (branch-tip, zie social.yml); GITHUB_SHA als terugval.
  const runnerCommit = process.env.RUNNER_COMMIT ?? process.env.GITHUB_SHA;
  const gestart = Date.now();
  // Alleen in CI (runner-commit bekend) wachten we op de deploy; lokaal faalt een fout meteen.
  const binnenVenster = () => Boolean(runnerCommit) && Date.now() - gestart < WACHT_MAX_MS;
  for (;;) {
    let planning: PlanningJson;
    try {
      planning = await haalPlanningEenmaal(url);
    } catch (err) {
      if (err instanceof TijdelijkeFout && binnenVenster()) {
        console.log(`${err.message}; opnieuw over 30 s…`);
        await wacht(WACHT_STAP_MS);
        continue;
      }
      throw err;
    }
    const check = commitKomtOvereen(planning.commit ?? null, runnerCommit);
    if (check === "overeen") return planning;
    if (check === "onbekend") {
      console.log("Versheidscheck overgeslagen (geen commit-hash in de planning of geen RUNNER_COMMIT/GITHUB_SHA).");
      return planning;
    }
    if (Date.now() - gestart >= WACHT_MAX_MS) {
      console.warn(`⚠ Planning komt van deploy ${planning.commit?.slice(0, 7)}, runner staat op ${runnerCommit?.slice(0, 7)}; na 10 minuten wachten toch doorgegaan.`);
      return planning;
    }
    console.log(`Deploy nog niet live (planning ${planning.commit?.slice(0, 7)} ≠ runner ${runnerCommit?.slice(0, 7)}); opnieuw over 30 s…`);
    await wacht(WACHT_STAP_MS);
  }
}

/** De Buffer-kanalen van de enige organisatie. */
async function haalKanalen(client: BufferClient): Promise<BufferKanaal[]> {
  const orgs = await client.organisaties();
  if (orgs.length !== 1) {
    throw new Error(`Verwacht één Buffer-organisatie, gevonden ${orgs.length}: ${orgs.map((o) => `${o.name}=${o.id}`).join(", ")}`);
  }
  return client.kanalen(orgs[0].id);
}

/** Kanaal-id's via Buffer; zonder client (dry-run zonder sleutel) doen we alsof alle drie bestaan. */
function bepaalKanalen(lijst: BufferKanaal[] | null): Ontdekking {
  const overrides = overridesUitEnv(process.env);
  if (!lijst) {
    console.log("Geen BUFFER_API_KEY: kanalen niet gecontroleerd (dry-run).");
    const ids: KanaalIds = { ...overrides };
    for (const k of KANALEN) ids[k] ??= "dry-run";
    return { ids, ontbrekend: [] };
  }
  return ontdekKanalen(lijst, overrides);
}

async function main() {
  if (CONCEPT && DRY_RUN) throw new Error("--concept en --dry-run gaan niet samen; kies er één.");
  if (!isGeldigeIsoDatum(DATUM)) throw new Error(`Ongeldige --datum: ${DATUM}`);
  if (!BASIS.startsWith("https://") && !DRY_RUN && !ALLEEN_KANALEN) {
    throw new Error("--basis zonder https is alleen toegestaan met --dry-run of --kanalen (Buffer kan lokale beelden niet ophalen).");
  }
  const sleutel = process.env.BUFFER_API_KEY;
  const client = sleutel ? maakBufferClient(sleutel) : null;

  if (ALLEEN_KANALEN) {
    if (!client) {
      console.error("Kanalen opvragen vereist BUFFER_API_KEY.");
      process.exitCode = 1;
      return;
    }
    // Ruwe lijst, zonder ontdekking: juist bij dubbele kanalen is dit het hulpmiddel om de override te kiezen.
    for (const k of await haalKanalen(client)) console.log(`${k.service.padEnd(10)} ${k.id}  ${k.name}`);
    return;
  }
  if (!client && !DRY_RUN) {
    console.log("BUFFER_API_KEY ontbreekt: Buffer-adapter overgeslagen.");
    meldAanCi("BUFFER_API_KEY ontbreekt: Buffer-adapter overgeslagen.", 0);
    return;
  }

  const { ids, ontbrekend } = bepaalKanalen(client ? await haalKanalen(client) : null);
  for (const k of ontbrekend) console.warn(`⚠ Geen ${k}-kanaal in Buffer; ${k} wordt overgeslagen.`);

  const planning = await haalPlanning();
  const nu = new Date();
  const { gekozen, overgeslagen } = kiesPosts(planning, todayISOInTimeZone(nu), nu);
  for (const o of overgeslagen) console.log(`– ${o.post.id}: ${o.reden}`);
  if (gekozen.length === 0) {
    console.log(`Geen posts om in te plannen voor ${DATUM}.`);
    meldAanCi(`Geen posts om in te plannen voor ${DATUM}.`, 0);
    return;
  }

  console.log(`Buffer-adapter ${DATUM} (${MODUS}): ${gekozen.length} post(s) × ${KANALEN.length} kanalen\n`);

  let grootboek = leesGrootboek();
  const run = process.env.GITHUB_RUN_ID ?? "lokaal";
  const resultaten: Resultaat[] = [];
  const telIngepland = () => resultaten.filter((r) => r.status === "ingepland").length;
  let mislukt = 0;

  for (const { post, dueAt } of gekozen) {
    for (const kanaal of KANALEN) {
      const basis: { post: string; kanaal: Kanaal; dueAt: string } = { post: post.id, kanaal, dueAt };
      const kanaalId = ids[kanaal];
      const bestaand = zoekRegel(grootboek, post.id, kanaal);
      const actie = besluit({ kanaalId, inGrootboek: Boolean(bestaand), modus: MODUS });
      if (actie === "kanaal ontbreekt" || !kanaalId) {
        resultaten.push({ ...basis, status: "kanaal ontbreekt", detail: "" });
        continue;
      }
      if (actie === "al in Buffer") {
        resultaten.push({ ...basis, status: "al in Buffer", detail: bestaand?.bufferId ?? "" });
        continue;
      }
      const input = bouwInput(post, kanaal, kanaalId, dueAt, { concept: CONCEPT });
      if (actie === "dry-run" || !client) {
        resultaten.push({ ...basis, status: "dry-run", detail: `${input.assets.length} slides, ${input.text.length} tekens` });
        continue;
      }

      let aangemaakt: BufferPost;
      try {
        aangemaakt = await client.maakPost(input);
      } catch (err) {
        mislukt += 1;
        let detail = err instanceof Error ? err.message : String(err);
        // Bij een netwerkfout weten we niet of Buffer de post al had aangenomen.
        if (detail.includes("Buffer onbereikbaar") || detail.startsWith("Buffer HTTP 5")) detail += " (mogelijk wel aangemaakt; controleer Buffer vóór een herstart)";
        resultaten.push({ ...basis, status: "mislukt", detail });
        continue;
      }

      if (CONCEPT) {
        console.log(`✓ concept ${post.id} ${kanaal} → ${aangemaakt.id}`);
        resultaten.push({ ...basis, status: "concept", detail: aangemaakt.id });
        continue;
      }

      // Direct wegschrijven: een crash verderop mag een al geplaatste post niet vergeten.
      grootboek = voegRegelToe(grootboek, { post: post.id, kanaal, bufferId: aangemaakt.id, dueAt, aangemaakt: new Date().toISOString(), run });
      try {
        schrijfGrootboek(grootboek);
      } catch (err) {
        // Doorgaan zou bij een herstart een dubbele post opleveren: hier stoppen.
        resultaten.push({ ...basis, status: "mislukt", detail: `staat in Buffer als ${aangemaakt.id}; grootboek niet geschreven` });
        console.error(`✗ ${post.id} ${kanaal}: staat in Buffer als ${aangemaakt.id} maar het grootboek kon niet worden geschreven; voeg de regel handmatig toe vóór een herstart`);
        console.error(err instanceof Error ? err.message : String(err));
        const tabel = resultaatTabel(resultaten);
        console.log(`\n${tabel}`);
        try {
          meldAanCi(tabel, telIngepland());
        } catch {
          // De samenvatting is bijzaak; de melding hierboven telt.
        }
        process.exit(1);
      }
      console.log(`✓ ${post.id} ${kanaal} → ${aangemaakt.id}`);
      resultaten.push({ ...basis, status: "ingepland", detail: aangemaakt.id });
    }
  }

  const tabel = resultaatTabel(resultaten);
  console.log(tabel);
  const ingepland = telIngepland();
  meldAanCi(tabel, ingepland);
  if (ingepland > 0) console.log(`\n${ingepland} post(s) ingepland; grootboek: ${SOCIAL_BUFFER_LOG_PATH}`);
  if (CONCEPT && !DRY_RUN) console.log("\nConcepten staan in Buffer ter controle; verwijder ze daar na het nakijken.");
  if (mislukt > 0) {
    console.error(`\n${mislukt} post(s) mislukt`);
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});

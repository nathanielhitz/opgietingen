/*
  Buffer-adapter: leest de weekplanning van de site (/social/planning) en zet
  elke post ingepland in Buffer voor Facebook, Instagram en TikTok. Draait
  wekelijks vanuit .github/workflows/social.yml. Spec:
  docs/superpowers/specs/2026-09-23-social-buffer-adapter-design.md

    npm run social-buffer                          # inplannen (vereist BUFFER_API_KEY)
    npm run social-buffer -- --concept             # alles als concept in Buffer (verificatie; grootboek blijft ongemoeid)
    npm run social-buffer -- --dry-run             # toon wat er zou gebeuren; geen Buffer-aanroepen, schrijft niets
    npm run social-buffer -- --kanalen             # print de gekoppelde kanalen met id en stop
    npm run social-buffer -- --datum 2026-09-28    # andere referentiedatum (default: vandaag NL-tijd)
    npm run social-buffer -- --basis http://localhost:3000   # alleen zinvol met --dry-run/--kanalen

  Env: BUFFER_API_KEY (zonder: overslaan met exitcode 0), optioneel
       BUFFER_KANAAL_FACEBOOK / _INSTAGRAM / _TIKTOK (kanaal-id-override);
       in CI GITHUB_SHA (versheidscheck), GITHUB_RUN_ID, GITHUB_STEP_SUMMARY, GITHUB_OUTPUT.
*/
import fs from "node:fs";
import { isGeldigeIsoDatum, todayISOInTimeZone } from "../src/lib/dates";
import { KANALEN, type Kanaal } from "../src/lib/social";
import type { PlanningJson } from "../src/lib/social-planning";
import { leesGrootboek, schrijfGrootboek, voegRegelToe, zoekRegel, SOCIAL_BUFFER_LOG_PATH } from "../src/lib/social-buffer-log";
import { maakBufferClient, type BufferClient } from "./lib/buffer-client";
import {
  bouwInput,
  commitKomtOvereen,
  kiesPosts,
  ontdekKanalen,
  overridesUitEnv,
  resultaatTabel,
  type KanaalIds,
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

/** Versheidscheck: zo lang wachten op de Vercel-deploy van de scrape-commit, in stappen van 30 s. */
const WACHT_MAX_MS = 10 * 60_000;
const WACHT_STAP_MS = 30_000;

async function haalPlanning(): Promise<PlanningJson> {
  const url = `${BASIS}/social/planning?datum=${DATUM}`;
  const gestart = Date.now();
  for (;;) {
    const res = await fetch(url, { signal: AbortSignal.timeout(20_000) });
    if (!res.ok) throw new Error(`Planning ophalen mislukt: ${url} → HTTP ${res.status}`);
    const planning = (await res.json()) as PlanningJson;
    const runner = process.env.GITHUB_SHA;
    const check = commitKomtOvereen(planning.commit ?? null, runner);
    if (check === "overeen") return planning;
    if (check === "onbekend") {
      console.log("Versheidscheck overgeslagen (geen commit-hash in de planning of geen GITHUB_SHA).");
      return planning;
    }
    if (Date.now() - gestart >= WACHT_MAX_MS) {
      console.warn(`⚠ Planning komt van deploy ${planning.commit?.slice(0, 7)}, runner staat op ${runner?.slice(0, 7)}; na 10 minuten wachten toch doorgegaan.`);
      return planning;
    }
    console.log(`Deploy nog niet live (planning ${planning.commit?.slice(0, 7)} ≠ runner ${runner?.slice(0, 7)}); opnieuw over 30 s…`);
    await new Promise((r) => setTimeout(r, WACHT_STAP_MS));
  }
}

/** Kanaal-id's via Buffer; bij --dry-run zonder sleutel doen we alsof alle drie bestaan. */
async function bepaalKanalen(client: BufferClient | null): Promise<{ ids: KanaalIds; ontbrekend: Kanaal[] }> {
  const overrides = overridesUitEnv(process.env);
  if (!client) {
    console.log("Geen BUFFER_API_KEY: kanalen niet gecontroleerd (dry-run).");
    const ids: KanaalIds = { ...overrides };
    for (const k of KANALEN) ids[k] ??= "dry-run";
    return { ids, ontbrekend: [] };
  }
  const orgs = await client.organisaties();
  if (orgs.length !== 1) {
    throw new Error(`Verwacht één Buffer-organisatie, gevonden ${orgs.length}: ${orgs.map((o) => `${o.name}=${o.id}`).join(", ")}`);
  }
  const kanalen = await client.kanalen(orgs[0].id);
  if (ALLEEN_KANALEN) {
    for (const k of kanalen) console.log(`${k.service.padEnd(10)} ${k.id}  ${k.name}`);
    process.exit(0);
  }
  return ontdekKanalen(kanalen, overrides);
}

async function main() {
  if (!isGeldigeIsoDatum(DATUM)) throw new Error(`Ongeldige --datum: ${DATUM}`);
  const sleutel = process.env.BUFFER_API_KEY;
  if (!sleutel && !DRY_RUN) {
    console.log("BUFFER_API_KEY ontbreekt: Buffer-adapter overgeslagen.");
    return;
  }
  const client = sleutel ? maakBufferClient(sleutel) : null;

  const { ids, ontbrekend } = await bepaalKanalen(client);
  for (const k of ontbrekend) console.warn(`⚠ Geen ${k}-kanaal in Buffer; ${k} wordt overgeslagen.`);

  const planning = await haalPlanning();
  const { gekozen, overgeslagen } = kiesPosts(planning, todayISOInTimeZone(), new Date());
  for (const o of overgeslagen) console.log(`– ${o.post.id}: ${o.reden}`);
  if (gekozen.length === 0) {
    console.log(`Geen posts om in te plannen voor ${DATUM}.`);
    return;
  }

  const modus = DRY_RUN ? "dry-run" : CONCEPT ? "concept" : "inplannen";
  console.log(`Buffer-adapter ${DATUM} (${modus}): ${gekozen.length} post(s) × ${KANALEN.length} kanalen\n`);

  let grootboek = leesGrootboek();
  const run = process.env.GITHUB_RUN_ID ?? "lokaal";
  const resultaten: Resultaat[] = [];
  let mislukt = 0;

  for (const { post, dueAt } of gekozen) {
    for (const kanaal of KANALEN) {
      const basis = { post: post.id, kanaal, dueAt };
      const kanaalId = ids[kanaal];
      if (!kanaalId) {
        resultaten.push({ ...basis, status: "kanaal ontbreekt", detail: "" });
        continue;
      }
      const bestaand = zoekRegel(grootboek, post.id, kanaal);
      if (!CONCEPT && bestaand) {
        resultaten.push({ ...basis, status: "al in Buffer", detail: bestaand.bufferId });
        continue;
      }
      const input = bouwInput(post, kanaal, kanaalId, dueAt, { concept: CONCEPT });
      if (DRY_RUN || !client) {
        resultaten.push({ ...basis, status: "dry-run", detail: `${input.assets.length} slides, ${input.text.length} tekens` });
        continue;
      }
      try {
        const aangemaakt = await client.maakPost(input);
        if (CONCEPT) {
          resultaten.push({ ...basis, status: "concept", detail: aangemaakt.id });
        } else {
          // Direct wegschrijven: een crash verderop mag een al geplaatste post niet vergeten.
          grootboek = voegRegelToe(grootboek, { post: post.id, kanaal, bufferId: aangemaakt.id, dueAt, aangemaakt: new Date().toISOString(), run });
          schrijfGrootboek(grootboek);
          resultaten.push({ ...basis, status: "ingepland", detail: aangemaakt.id });
        }
      } catch (err) {
        mislukt += 1;
        resultaten.push({ ...basis, status: "mislukt", detail: err instanceof Error ? err.message : String(err) });
      }
    }
  }

  const tabel = resultaatTabel(resultaten);
  console.log(tabel);
  const ingepland = resultaten.filter((r) => r.status === "ingepland").length;
  if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, `## Social-posts ${DATUM} (${modus})\n\n${tabel}\n`);
  if (process.env.GITHUB_OUTPUT) fs.appendFileSync(process.env.GITHUB_OUTPUT, `ingepland=${ingepland}\n`);
  if (ingepland > 0) console.log(`\n${ingepland} post(s) ingepland; grootboek: ${SOCIAL_BUFFER_LOG_PATH}`);
  if (CONCEPT) console.log("\nConcepten staan in Buffer ter controle; verwijder ze daar na het nakijken.");
  if (mislukt > 0) {
    console.error(`\n${mislukt} post(s) mislukt`);
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});

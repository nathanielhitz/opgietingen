/*
  Rooster-hercheck (audit-vervolg op de opgietroosters van 2026-07-24).
  De vaste opgiettijden op sauna-profielen (frontmatter `opgietRooster`)
  verouderen; dit script hercontroleert roosters waarvan `roosterGecheckt`
  ouder is dan --max-dagen (default 60):

    1. Bepaalt per profiel de controle-URL: de agendaUrl van de bijbehorende
       bron in content/bronnen.json (id = saunaSlug), anders de website.
    2. Kale fetch (robots.txt wordt nageleefd; bewust géén Firecrawl —
       credits zijn schaars en een gemiste check is geen ramp).
    3. Claude (claude-haiku-4-5) vergelijkt ons rooster met de paginatekst.
       Bevestigd → `roosterGecheckt` wordt vandaag (minimale diff).
       Niet bevestigd / niet controleerbaar → probleem in rooster-check.json,
       dat scrape-report.ts meeneemt in het wekelijkse scraper-issue.

  Gebruik:
    npm run check-roosters                  # hercheck verouderde roosters
    npm run check-roosters -- --max-dagen 30
    npm run check-roosters -- --dry-run     # alleen tonen wat verouderd is

  Env: ANTHROPIC_API_KEY (zonder key slaat het script zichzelf netjes over).
*/
import fs from "node:fs";
import Anthropic from "@anthropic-ai/sdk";
import { readBronnen, htmlToText } from "./lib/content";
import { readRoosterProfielen, isVerouderd, dagenSinds, roosterNaarTekst, vervangRoosterGecheckt } from "./lib/rooster";
import { fetchUrl, isAllowed, sleep, REQUEST_DELAY_MS } from "./lib/net";
import { todayISOInTimeZone } from "../src/lib/dates";

const MODEL = "claude-haiku-4-5";
/** Minder statische tekst dan dit → vermoedelijk JS-shell; niet te beoordelen. */
const MIN_TEKST_CHARS = 500;

function argValue(name: string): string | undefined {
  const i = process.argv.indexOf(name);
  return i !== -1 ? process.argv[i + 1] : undefined;
}

const DRY_RUN = process.argv.includes("--dry-run");
const MAX_DAGEN = argValue("--max-dagen") ? Number(argValue("--max-dagen")) : 60;
const VANDAAG = todayISOInTimeZone();
const RAPPORT_PATH = "rooster-check.json";

export interface RoosterProbleem {
  slug: string;
  naam: string;
  url?: string;
  probleem: string;
}

interface Beoordeling {
  /**
   * bevestigd     = de kern van het rooster staat (in dezelfde strekking) op de pagina;
   * afwijkend     = het rooster staat op de pagina maar met andere dagen/tijden — echt signaal;
   * niet-gevonden = de pagina bevat het rooster niet (het staat elders op de site of alleen
   *                 in beeld/PDF) — geen bewijs van veroudering, wel niet-controleerbaar.
   */
  oordeel: "bevestigd" | "afwijkend" | "niet-gevonden";
  toelichting: string;
}

async function beoordeelRooster(
  client: Anthropic,
  saunaNaam: string,
  roosterTekst: string,
  paginaTekst: string,
): Promise<Beoordeling> {
  const message = await client.messages.create({
    model: MODEL,
    max_tokens: 1024,
    system:
      "Je controleert of het vaste opgietrooster dat een sauna-agenda toont nog klopt met een pagina " +
      "van de eigen website van de sauna. Je roept altijd de tool beoordeel_rooster aan. " +
      "Let op: sommige roosters zijn bewust globaal ('gemiddeld 6 opgietingen per dag, tijden op de dag " +
      "zelf'); geef 'bevestigd' wanneer de pagina dezelfde strekking heeft, ook zonder exacte tijden. " +
      "Kies 'afwijkend' ALLEEN als de pagina het rooster wél toont maar met andere dagen/tijden/aantallen. " +
      "Toont de pagina het rooster helemaal niet (bv. alleen losse events, een verwijzing naar een schema " +
      "elders, of een schema als afbeelding), kies dan 'niet-gevonden'.",
    tools: [
      {
        name: "beoordeel_rooster",
        description: "Geef je oordeel over het rooster.",
        input_schema: {
          type: "object",
          additionalProperties: false,
          properties: {
            oordeel: {
              type: "string",
              enum: ["bevestigd", "afwijkend", "niet-gevonden"],
              description:
                "bevestigd = zelfde strekking staat op de pagina; afwijkend = rooster staat er maar met andere dagen/tijden; niet-gevonden = de pagina toont het rooster niet",
            },
            toelichting: {
              type: "string",
              description:
                "Kort (max 2 zinnen): wat er afwijkt, of waarom het rooster niet op de pagina te vinden is. Bij bevestiging: 'klopt'.",
            },
          },
          required: ["oordeel", "toelichting"],
        },
      },
    ],
    tool_choice: { type: "tool", name: "beoordeel_rooster" },
    messages: [
      {
        role: "user",
        content:
          `Sauna: ${saunaNaam}\n\nOns rooster:\n${roosterTekst}\n\n` +
          `PAGINATEKST (eigen website):\n\n${paginaTekst.slice(0, 30000)}`,
      },
    ],
  });

  const toolUse = message.content.find(
    (b): b is Anthropic.ToolUseBlock => b.type === "tool_use" && b.name === "beoordeel_rooster",
  );
  const input = toolUse?.input as Partial<Beoordeling> | undefined;
  const oordeel =
    input?.oordeel === "bevestigd" || input?.oordeel === "afwijkend" ? input.oordeel : "niet-gevonden";
  return {
    oordeel,
    toelichting: typeof input?.toelichting === "string" ? input.toelichting : "geen toelichting",
  };
}

async function main() {
  const profielen = readRoosterProfielen();
  const verouderd = profielen.filter((p) => isVerouderd(p.gecheckt, VANDAAG, MAX_DAGEN));

  console.log(
    `Rooster-hercheck${DRY_RUN ? " (DRY-RUN)" : ""}: ${verouderd.length} van ${profielen.length} ` +
      `roosters ouder dan ${MAX_DAGEN} dagen (referentie ${VANDAAG}).\n`,
  );

  if (verouderd.length === 0) {
    fs.writeFileSync(RAPPORT_PATH, JSON.stringify({ gecontroleerd: VANDAAG, problemen: [] }, null, 2) + "\n");
    console.log("Niets te doen.");
    return;
  }

  if (DRY_RUN) {
    for (const p of verouderd) {
      const dagen = dagenSinds(p.gecheckt, VANDAAG);
      console.log(`- ${p.naam} (${p.slug}): ${p.gecheckt ?? "nooit gecheckt"}${Number.isFinite(dagen) ? `, ${dagen} dagen geleden` : ""}`);
    }
    return;
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    console.log("ANTHROPIC_API_KEY ontbreekt — rooster-hercheck overgeslagen.");
    return;
  }
  const client = new Anthropic();

  const bronnen = readBronnen().bronnen;
  const problemen: RoosterProbleem[] = [];
  const nietControleerbaar: RoosterProbleem[] = [];
  let bevestigd = 0;

  for (const p of verouderd) {
    const bron = bronnen.find((b) => b.id === p.slug && b.agendaUrl?.startsWith("http"));
    // Voorkeur: expliciete roosterBron (waar het rooster letterlijk staat) >
    // agenda-URL van de bron > website. Zonder roosterBron toont de agenda-
    // pagina het rooster vaak niet; dat is dan "niet-gevonden", geen afwijking.
    const url = p.roosterBron ?? bron?.agendaUrl ?? p.website;
    if (!url) {
      problemen.push({ slug: p.slug, naam: p.naam, probleem: "geen controle-URL (geen bron of website)" });
      console.log(`✗ ${p.naam}: geen controle-URL.`);
      continue;
    }

    if (!(await isAllowed(url))) {
      problemen.push({ slug: p.slug, naam: p.naam, url, probleem: "robots.txt blokkeert de controle-URL" });
      console.log(`✗ ${p.naam}: robots.txt blokkeert ${url}.`);
      continue;
    }

    const res = await fetchUrl(url);
    const tekst = res.ok ? htmlToText(res.body) : "";
    if (!res.ok || tekst.length < MIN_TEKST_CHARS) {
      if (res.ok) {
        nietControleerbaar.push({
          slug: p.slug,
          naam: p.naam,
          url,
          probleem: `te weinig statische tekst (${tekst.length} tekens; vermoedelijk JS-gerenderd)`,
        });
        console.log(`· ${p.naam}: JS-pagina, niet automatisch controleerbaar (${url}).`);
      } else {
        problemen.push({
          slug: p.slug,
          naam: p.naam,
          url,
          probleem: `pagina onbereikbaar (HTTP ${res.status}${res.error ? `, ${res.error}` : ""})`,
        });
        console.log(`✗ ${p.naam}: onbereikbaar (${url}).`);
      }
      await sleep(REQUEST_DELAY_MS);
      continue;
    }

    try {
      const oordeel = await beoordeelRooster(client, p.naam, roosterNaarTekst(p.rooster), tekst);
      if (oordeel.oordeel === "bevestigd") {
        const raw = fs.readFileSync(p.filePath, "utf-8");
        const nieuw = vervangRoosterGecheckt(raw, VANDAAG);
        if (nieuw) fs.writeFileSync(p.filePath, nieuw);
        bevestigd++;
        console.log(`✓ ${p.naam}: rooster bevestigd; roosterGecheckt → ${VANDAAG}.`);
      } else if (oordeel.oordeel === "afwijkend") {
        problemen.push({ slug: p.slug, naam: p.naam, url, probleem: `rooster wijkt af: ${oordeel.toelichting}` });
        console.log(`✗ ${p.naam}: ${oordeel.toelichting}`);
      } else {
        // Rooster niet op deze pagina — geen bewijs van veroudering. Het
        // profiel blijft op de oude gecheckt-datum staan en komt vanzelf via
        // de 90-dagen-staleness in het rapport als handmatige check.
        nietControleerbaar.push({ slug: p.slug, naam: p.naam, url, probleem: oordeel.toelichting });
        console.log(`· ${p.naam}: rooster niet op de controle-pagina (${oordeel.toelichting})`);
      }
    } catch (err) {
      problemen.push({
        slug: p.slug,
        naam: p.naam,
        url,
        probleem: `controle mislukt: ${err instanceof Error ? err.message : String(err)}`,
      });
      console.log(`✗ ${p.naam}: controle mislukt.`);
    }

    await sleep(REQUEST_DELAY_MS);
  }

  fs.writeFileSync(
    RAPPORT_PATH,
    JSON.stringify({ gecontroleerd: VANDAAG, problemen, nietControleerbaar }, null, 2) + "\n",
  );
  console.log(
    `\nKlaar. ${bevestigd} bevestigd, ${problemen.length} probleem/problemen, ` +
      `${nietControleerbaar.length} niet controleerbaar → ${RAPPORT_PATH}.`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

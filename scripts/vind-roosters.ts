/*
  Rooster-vinder (GSC-indexeringsplan augustus 2026, fase 2.2).

  Tegenhanger van check-roosters: dát script *verifieert* bestaande roosters,
  dit script *vindt* er nieuwe voor sauna-profielen die er nog géén hebben.
  Zonder rooster heeft een provinciepagina zonder geplande events niets te
  tonen — en dat is precies waarom die pagina's niet geïndexeerd raken.

  Het schrijft bewust NIET in de profielen. Een bestaand rooster bevestigen is
  een kleine claim; een nieuw rooster opvoeren is een grote, en de kwaliteits-
  filosofie van deze codebase is bij twijfel afkeuren. De voorstellen komen in
  rooster-voorstellen.json met de letterlijke bronregel erbij, zodat je ze in
  één blik kunt goedkeuren en overnemen in de frontmatter.

  Gebruik:
    npm run vind-roosters                    # alle profielen zonder rooster
    npm run vind-roosters -- --sauna lago    # één profiel
    npm run vind-roosters -- --dry-run       # toon alleen wie er aan de beurt is

  Env: ANTHROPIC_API_KEY (zonder key slaat het script zichzelf netjes over).
*/
import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import Anthropic from "@anthropic-ai/sdk";
import { readBronnen, htmlToText } from "./lib/content";
import { fetchUrl, isAllowed, sleep, REQUEST_DELAY_MS } from "./lib/net";
import { todayISOInTimeZone } from "../src/lib/dates";

const MODEL = "claude-haiku-4-5";
const SAUNAS_DIR = path.join(process.cwd(), "content", "saunas");
const RAPPORT_PATH = "rooster-voorstellen.json";
/** Minder statische tekst dan dit → vermoedelijk JS-shell; niet te beoordelen. */
const MIN_TEKST_CHARS = 500;

function argValue(name: string): string | undefined {
  const i = process.argv.indexOf(name);
  return i !== -1 ? process.argv[i + 1] : undefined;
}

const DRY_RUN = process.argv.includes("--dry-run");
const SAUNA = argValue("--sauna");
const VANDAAG = todayISOInTimeZone();

interface KaalProfiel {
  slug: string;
  naam: string;
  website?: string;
  roosterBron?: string;
}

interface Voorstel {
  slug: string;
  naam: string;
  url: string;
  regels: { dag: string; tijden: string }[];
  /** Letterlijk citaat van de pagina waarop het voorstel steunt. */
  bronregel: string;
}

/** Profielen zonder (of met een leeg) opgietRooster. */
function leesKaleProfielen(): KaalProfiel[] {
  const out: KaalProfiel[] = [];
  for (const file of fs.readdirSync(SAUNAS_DIR).filter((f) => f.endsWith(".mdx"))) {
    const { data } = matter(fs.readFileSync(path.join(SAUNAS_DIR, file), "utf-8"));
    const rooster = data.opgietRooster;
    if (Array.isArray(rooster) && rooster.length > 0) continue;
    out.push({
      slug: file.replace(/\.mdx$/, ""),
      naam: String(data.naam ?? file),
      website: typeof data.website === "string" ? data.website : undefined,
      roosterBron: typeof data.roosterBron === "string" ? data.roosterBron : undefined,
    });
  }
  return out;
}

interface Extractie {
  gevonden: boolean;
  regels: { dag: string; tijden: string }[];
  bronregel: string;
}

async function extraheerRooster(
  client: Anthropic,
  saunaNaam: string,
  paginaTekst: string,
): Promise<Extractie> {
  const message = await client.messages.create({
    model: MODEL,
    max_tokens: 1024,
    system:
      "Je haalt het VASTE opgietrooster (Aufguss-tijden) van een sauna uit de tekst van hun eigen website. " +
      "Je roept altijd de tool geef_rooster aan. Neem uitsluitend over wat er letterlijk staat: dagen en " +
      "tijden, of een expliciete globale formulering ('elk heel uur', 'gemiddeld 6 opgietingen per dag'). " +
      "Losse, gedateerde events (een themadag op 14 september) zijn GEEN vast rooster: gevonden=false. " +
      "Twijfel je, of staat het rooster alleen in een afbeelding of PDF, dan gevonden=false. " +
      "Verzin nooit tijden en rond nooit af.",
    tools: [
      {
        name: "geef_rooster",
        description: "Geef het gevonden vaste opgietrooster.",
        input_schema: {
          type: "object",
          additionalProperties: false,
          properties: {
            gevonden: {
              type: "boolean",
              description: "true alleen als de pagina een vast opgietrooster letterlijk vermeldt",
            },
            regels: {
              type: "array",
              description: "Eén regel per dag(groep). Leeg als gevonden=false.",
              items: {
                type: "object",
                additionalProperties: false,
                properties: {
                  dag: { type: "string", description: "Bijv. 'Maandag t/m vrijdag' of 'Zaterdag & zondag'" },
                  tijden: { type: "string", description: "Bijv. '13:00, 15:00, 17:00' of 'elk heel uur van 12:00 tot 21:00'" },
                },
                required: ["dag", "tijden"],
              },
            },
            bronregel: {
              type: "string",
              description: "Letterlijk citaat (max 200 tekens) uit de paginatekst waarop dit steunt. Leeg als gevonden=false.",
            },
          },
          required: ["gevonden", "regels", "bronregel"],
        },
      },
    ],
    tool_choice: { type: "tool", name: "geef_rooster" },
    messages: [
      {
        role: "user",
        content: `Sauna: ${saunaNaam}\n\nPAGINATEKST (eigen website):\n\n${paginaTekst.slice(0, 30000)}`,
      },
    ],
  });

  const toolUse = message.content.find(
    (b): b is Anthropic.ToolUseBlock => b.type === "tool_use" && b.name === "geef_rooster",
  );
  const input = toolUse?.input as Partial<Extractie> | undefined;
  const regels = Array.isArray(input?.regels)
    ? input.regels
        .filter((r) => r && typeof r.dag === "string" && typeof r.tijden === "string" && r.dag && r.tijden)
        .map((r) => ({ dag: r.dag, tijden: r.tijden }))
    : [];
  return {
    gevonden: input?.gevonden === true && regels.length > 0,
    regels,
    bronregel: typeof input?.bronregel === "string" ? input.bronregel : "",
  };
}

async function main() {
  const kale = leesKaleProfielen();
  const doel = SAUNA ? kale.filter((p) => p.slug === SAUNA) : kale;

  if (SAUNA && doel.length === 0) {
    console.log(`"${SAUNA}" heeft al een rooster, of bestaat niet als profiel.`);
    process.exitCode = 1;
    return;
  }

  console.log(
    `Rooster-vinder${DRY_RUN ? " (DRY-RUN)" : ""}: ${doel.length} profiel(en) zonder rooster (referentie ${VANDAAG}).\n`,
  );

  if (DRY_RUN) {
    for (const p of doel) console.log(`- ${p.naam} (${p.slug}): ${p.website ?? "geen website"}`);
    return;
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    console.log("ANTHROPIC_API_KEY ontbreekt — rooster-vinder overgeslagen.");
    return;
  }
  const client = new Anthropic();

  const bronnen = readBronnen().bronnen;
  const voorstellen: Voorstel[] = [];
  const zonderResultaat: { slug: string; naam: string; reden: string }[] = [];

  for (const p of doel) {
    const bron = bronnen.find((b) => b.id === p.slug && b.agendaUrl?.startsWith("http"));
    const url = p.roosterBron ?? bron?.agendaUrl ?? p.website;
    if (!url) {
      zonderResultaat.push({ slug: p.slug, naam: p.naam, reden: "geen URL (geen bron of website)" });
      console.log(`✗ ${p.naam}: geen URL.`);
      continue;
    }

    if (!(await isAllowed(url))) {
      zonderResultaat.push({ slug: p.slug, naam: p.naam, reden: `robots.txt blokkeert ${url}` });
      console.log(`✗ ${p.naam}: robots.txt blokkeert ${url}.`);
      continue;
    }

    const res = await fetchUrl(url);
    const tekst = res.ok ? htmlToText(res.body) : "";
    if (!res.ok || tekst.length < MIN_TEKST_CHARS) {
      const reden = res.ok
        ? `te weinig statische tekst (${tekst.length} tekens; vermoedelijk JS-gerenderd)`
        : `pagina onbereikbaar (HTTP ${res.status}${res.error ? `, ${res.error}` : ""})`;
      zonderResultaat.push({ slug: p.slug, naam: p.naam, reden });
      console.log(`· ${p.naam}: ${reden}`);
      await sleep(REQUEST_DELAY_MS);
      continue;
    }

    try {
      const extractie = await extraheerRooster(client, p.naam, tekst);
      if (extractie.gevonden) {
        voorstellen.push({ slug: p.slug, naam: p.naam, url, regels: extractie.regels, bronregel: extractie.bronregel });
        console.log(`✓ ${p.naam}: ${extractie.regels.length} regel(s) voorgesteld.`);
      } else {
        zonderResultaat.push({ slug: p.slug, naam: p.naam, reden: `geen vast rooster op ${url}` });
        console.log(`· ${p.naam}: geen vast rooster op de pagina.`);
      }
    } catch (err) {
      zonderResultaat.push({
        slug: p.slug,
        naam: p.naam,
        reden: `extractie mislukt: ${err instanceof Error ? err.message : String(err)}`,
      });
      console.log(`✗ ${p.naam}: extractie mislukt.`);
    }

    await sleep(REQUEST_DELAY_MS);
  }

  fs.writeFileSync(
    RAPPORT_PATH,
    JSON.stringify({ gezocht: VANDAAG, voorstellen, zonderResultaat }, null, 2) + "\n",
  );
  console.log(
    `\nKlaar. ${voorstellen.length} voorstel(len), ${zonderResultaat.length} zonder resultaat → ${RAPPORT_PATH}.` +
      `\nNeem goedgekeurde roosters over in de frontmatter (opgietRooster + roosterGecheckt: ${VANDAAG}).`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
